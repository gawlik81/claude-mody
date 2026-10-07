// Wytłumacz: polska wersja moda explain-it (Ruth-Ann Bravo, MIT).
// Wyjaśnia po polsku, krok po kroku i prostym językiem, co Claude właśnie
// zrobił, i za każdym razem uczy kilku nowych słówek technicznych.
// - /wytlumacz            wyjaśnia ostatnią pracę w tej sesji
// - /wytlumacz ostatnie   podsumowuje poprzednią sesję (z dziennika tur)
// - /wytlumacz historia   otwiera zapisane wyjaśnienia (◀ Starsze / Nowsze ▶)
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Saved, Status, Turn } from '../types'

const PANE = 'wytlumacz'
const TITLE = 'Wytłumacz mi'
const RECAP_MODEL = 'sonnet'

// W $.state, nie w zmiennych, żeby przeładowanie w trakcie tury ich nie zgubiło.
const status = atom({ plugin: 'wytlumacz', key: 'status' } as const, { kind: 'idle', message: '' })
const saved = atom({ plugin: 'wytlumacz', key: 'saved' } as const, [])
const viewing = atom({ plugin: 'wytlumacz', key: 'viewing' } as const, 0)
const hasChanges = atom({ plugin: 'wytlumacz', key: 'hasChanges' } as const, false)
const hasRecap = atom({ plugin: 'wytlumacz', key: 'hasRecap' } as const, false)
const didThings = atom({ plugin: 'wytlumacz', key: 'didThings' } as const, false)
const actions = atom({ plugin: 'wytlumacz', key: 'actions' } as const, [])
const prompt = atom({ plugin: 'wytlumacz', key: 'prompt' } as const, '')
const sessionStartedAt = atom({ plugin: 'wytlumacz', key: 'sessionStartedAt' } as const, 0)
const learnedCount = atom({ plugin: 'wytlumacz', key: 'learnedCount' } as const, 0)

// W $.store, między sesjami.
const LEARNED_KEY = 'learned-terms'
const SAVED_KEY = 'saved-explanations'
const JOURNAL_KEY = 'journal'

const DOING_TOOLS = /^(Bash|Edit|Write|NotebookEdit|MultiEdit)$/

const FORMAT = `Odpowiedz WYŁĄCZNIE po polsku. Użyj dokładnie tych nagłówków, w tej kolejności:

W SKRÓCIE — jedno zdanie o tym, co się zmieniło.
CO SIĘ STAŁO — lista numerowana (1., 2., 3. …), jedno krótkie zdanie na krok.
DLACZEGO — jedno lub dwa zdania: po co to było i dlaczego tak, a nie inaczej.
SŁÓWKA — 2-4 prawdziwe terminy techniczne z tej pracy, których używają inżynierowie. Każdy w osobnej linii, w formie: termin - co znaczy po ludzku - jak został tu użyty. Terminy zostaw w oryginalnym brzmieniu (np. webhook, hash). Wybieraj najbardziej przydatne, nie najbardziej egzotyczne.
TERAZ ZRÓB — jasno: czy muszę coś zrobić i co. Jeśli nic, napisz: "Nic - wszystko gotowe."

Bez emoji. Maksymalnie 400 słów. Opisuj tylko to, co faktycznie się wydarzyło.`

const NOW_PROMPT = `Wytłumacz mi, co zrobiłeś w swojej ostatniej pracy w tej rozmowie, krok po kroku, prostym językiem. Bez żargonu: jeśli techniczne słowo jest nieuniknione, wyjaśnij je w nawiasie codziennym porównaniem. ${FORMAT}`

const RECAP_PROMPT = `Poniżej jest dziennik tego, co Claude zrobił dla mnie we wcześniejszej sesji: o co prosiłem, które pliki zmienił, jakie komendy uruchomił i co powiedział na koniec. Podsumuj mi tamtą sesję krok po kroku, prostym językiem. Bez żargonu: jeśli techniczne słowo jest nieuniknione, wyjaśnij je w nawiasie codziennym porównaniem. ${FORMAT}`

const STYLE = [
  { match: /SKR[OÓ]CIE/i, emoji: '📌', color: 'cyan' },
  { match: /CO SI[EĘ] STA[LŁ]O/i, emoji: '👣', color: 'yellow' },
  { match: /DLACZEGO/i, emoji: '💡', color: 'green' },
  { match: /S[LŁ][OÓ]WKA/i, emoji: '📚', color: 'blue' },
  { match: /TERAZ ZR[OÓ]B/i, emoji: '✅', color: 'magenta' },
  { match: /./, emoji: '📝', color: 'white' },
]

const SLOWKA = /S[LŁ][OÓ]WKA/i
const FALLBACK = { emoji: '📝', color: 'white' }
const UPPER = 'A-ZĄĆĘŁŃÓŚŹŻ'
const HEAD = new RegExp(`^([${UPPER}][${UPPER} '"?,!]{3,}?)\\s*(?:[—:-]\\s*(.*))?$`, 'u')

// Dzieli wyjaśnienie na sekcje z nagłówkami.
function sections(text: string) {
  const out: { title: string; body: string }[] = []
  for (const line of text.split('\n')) {
    const clean = line.replace(/[*#]/g, '').trim()
    const head = clean.match(HEAD)
    const title = head?.[1]
    const last = out[out.length - 1]
    if (title && STYLE.slice(0, -1).some(s => s.match.test(title))) {
      out.push({ title: title.trim(), body: head?.[2] ?? '' })
    } else if (last && clean) {
      last.body = last.body ? `${last.body}\n${clean}` : clean
    }
  }
  return out.length ? out : [{ title: 'Co się stało', body: text }]
}

// Wyciąga terminy z sekcji SŁÓWKA.
function newTerms(text: string) {
  const words = sections(text).find(s => SLOWKA.test(s.title))
  if (!words) return []
  return words.body
    .split('\n')
    .map(l => l.replace(/^[-•\d.)\s]+/, '').split(/\s[—–-]\s/)[0]?.trim() ?? '')
    .filter(t => t.length > 0 && t.length < 40)
}

function listOf<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function projectName(cwd: string) {
  return cwd.split('/').filter(Boolean).pop() ?? cwd
}

const DAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.']
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

/** pon., 5 paź o 16:49 */
function when(at: number) {
  const d = new Date(at)
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} o ${d.getHours()}:${mm}`
}

// Poznane już terminy: używane swobodnie, bez ponownego definiowania.
async function learnedTerms($: EngineInterface): Promise<string[]> {
  return listOf<unknown>(await $.store.get(LEARNED_KEY)).filter((t): t is string => typeof t === 'string')
}

function withLearned(base: string, learned: string[]) {
  if (learned.length === 0) return base
  return `${base}

Terminy, które już znam (używaj ich swobodnie bez definiowania i nie wybieraj ich do sekcji SŁÓWKA): ${learned.join(', ')}.`
}

// Tury z ostatniej wcześniejszej sesji, od najstarszej.
async function previousSession($: EngineInterface) {
  const started = await read($, sessionStartedAt)
  const journal = listOf<Turn>(await $.store.get(JOURNAL_KEY)).filter(t => t.session !== started)
  if (journal.length === 0) return []
  const last = journal[journal.length - 1]?.session
  return journal.filter(t => t.session === last)
}

function logOf(turns: Turn[]) {
  return turns
    .map(
      (t, i) =>
        `--- Tura ${i + 1} (${when(t.at)}, projekt: ${t.project})\nProsiłem: ${t.prompt}\nCo zrobił Claude:\n${t.actions.map(a => `- ${a}`).join('\n')}\nOdpowiedź Claude'a: ${t.answer}`,
    )
    .join('\n\n')
}

// Pisze wyjaśnienie, zapisuje je i pokazuje w panelu.
async function explain($: EngineInterface, mode: 'now' | 'last') {
  await update($, hasChanges, () => false)
  await update($, hasRecap, () => false)
  await update($, status, () => ({ kind: 'writing', message: '' }) as Status)
  const opened = $.ui.open({ id: PANE, title: TITLE })

  const learned = await learnedTerms($)
  let label = 'Ta sesja'
  let project = projectName(await $.session.cwd())
  let r
  if (mode === 'last') {
    const turns = await previousSession($)
    if (turns.length === 0) {
      await update($, status, () => ({
        kind: 'failed',
        message: 'Nie ma jeszcze zapisanej wcześniejszej sesji. Dziennik prowadzę od teraz, więc następnym razem będzie co podsumować.',
      }) as Status)
      return
    }
    label = `Podsumowanie z ${when(turns[0]?.at ?? Date.now())}`
    project = turns[turns.length - 1]?.project ?? project
    r = await $.model.complete({ model: RECAP_MODEL, prompt: `${withLearned(RECAP_PROMPT, learned)}\n\n${logOf(turns)}` })
  } else {
    r = await $.model.fork({ prompt: withLearned(NOW_PROMPT, learned) })
  }
  if (!(await opened).isPlaced) $.ui.toast('Wyjaśnienie gotowe — poszerz okno albo wpisz /wytlumacz historia')

  if (!r.isAnswered) {
    await update($, status, () => ({
      kind: 'failed',
      message: `Nie udało się wytłumaczyć (${r.reason}). Spróbuj ponownie.`,
    }) as Status)
    return
  }

  const entry: Saved = { at: Date.now(), project, label, text: r.text }
  const all = [...listOf<Saved>(await $.store.get(SAVED_KEY)), entry].slice(-50)
  await $.store.set(SAVED_KEY, all)
  await update($, saved, () => all)
  await update($, viewing, () => all.length - 1)
  await update($, status, () => ({ kind: 'idle', message: '' }) as Status)

  const known = new Set(learned.map(t => t.toLowerCase()))
  const added = newTerms(r.text).filter(t => !known.has(t.toLowerCase()))
  if (added.length) {
    const terms = [...learned, ...added].slice(-300)
    await $.store.set(LEARNED_KEY, terms)
    await update($, learnedCount, () => terms.length)
  }
}

function start($: EngineInterface, mode: 'now' | 'last') {
  explain($, mode).catch(err =>
    update($, status, () => ({ kind: 'failed', message: `Nie udało się wytłumaczyć (${String(err)}). Spróbuj ponownie.` }) as Status),
  )
}

async function showHistory($: EngineInterface) {
  const all = await read($, saved)
  await update($, viewing, () => Math.max(0, all.length - 1))
  await update($, status, () => ({ kind: 'idle', message: '' }) as Status)
  await $.ui.open({ id: PANE, title: TITLE })
}

export const register: Register = (on, options) => {
  const showBand = options?.pasek === true

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await update($, sessionStartedAt, () => Date.now())
    const learned = await learnedTerms($)
    await update($, learnedCount, () => learned.length)
    const all = listOf<Saved>(await $.store.get(SAVED_KEY))
    await update($, saved, () => all)
    await update($, hasRecap, () => false)
    if ((await previousSession($)).length > 0) await update($, hasRecap, () => true)
    await $.command.register({
      name: 'wytlumacz',
      description: 'Wytłumacz po polsku, co Claude zrobił. "ostatnie" podsumowuje poprzednią sesję, "historia" otwiera zapisane',
      argumentHint: '[ostatnie|historia]',
    })
    return result
  })

  on('command.run', { command: 'wytlumacz' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'historia' || arg === 'history') {
      await showHistory($)
      return { text: 'Otworzyłem zapisane wyjaśnienia.' }
    }
    const mode = arg === 'ostatnie' || arg === 'last' ? 'last' : 'now'
    start($, mode)
    return { text: mode === 'last' ? 'Podsumowuję poprzednią sesję w panelu obok.' : 'Tłumaczę w panelu obok.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, didThings, () => false)
    await update($, hasChanges, () => false)
    await update($, hasRecap, () => false)
    await update($, actions, () => [])
    await update($, prompt, () => e.text.slice(0, 500))
    return next(e)
  })

  // Tylko główna rozmowa; subagenci raportują przez nią.
  on('tool.call', async ($, e, next) => {
    if (!e.agentId && DOING_TOOLS.test(e.tool)) {
      await update($, didThings, () => true)
      const input = e as unknown as { command?: unknown; file_path?: unknown; notebook_path?: unknown }
      const what =
        e.tool === 'Bash'
          ? `Uruchomił komendę: ${String(input.command ?? '').slice(0, 200)}`
          : `Zmienił plik: ${String(input.file_path ?? input.notebook_path ?? '')}`
      await update($, actions, list => [...list, what].slice(-40))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || !(await read($, didThings))) return result
    await update($, hasChanges, () => true)
    const turn: Turn = {
      at: Date.now(),
      session: await read($, sessionStartedAt),
      project: projectName(await $.session.cwd()),
      prompt: await read($, prompt),
      actions: await read($, actions),
      answer: result.text.slice(0, 1500),
    }
    const journal = [...listOf<Turn>(await $.store.get(JOURNAL_KEY)), turn].slice(-200)
    await $.store.set(JOURNAL_KEY, journal)
    return result
  })

  // Opcjonalna propozycja nad promptem (userConfig "pasek").
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!showBand || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    if (await read($, hasChanges)) {
      return (
        <Box>
          <Text color="cyan">🧩 Nie wiesz, co się właśnie stało? </Text>
          <Button key="explain" label="Wytłumacz" hotkey="w" onPress={() => start($, 'now')} />
          <Button key="dismiss" label="Nie, dzięki" onPress={() => update($, hasChanges, () => false)} />
        </Box>
      )
    }
    if (await read($, hasRecap)) {
      return (
        <Box>
          <Text color="cyan">🧩 Podsumować, co Claude zrobił ostatnim razem? </Text>
          <Button key="recap" label="Podsumuj" hotkey="p" onPress={() => start($, 'last')} />
          <Button key="dismiss" label="Nie, dzięki" onPress={() => update($, hasRecap, () => false)} />
        </Box>
      )
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, status)
    const all = await read($, saved)
    const i = Math.min(await read($, viewing), all.length - 1)
    const shown = all[i]
    const width = (e.viewport?.columns ?? 40) - 6
    const rule = '─'.repeat(Math.max(10, Math.min(e.surface === 'terminal' ? 40 : 22, width)))

    if (s.kind !== 'idle' || !shown) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">🧩 {TITLE}</Text>
          <Text dimColor>
            {s.kind === 'writing'
              ? '✨ Tłumaczę na ludzki…'
              : s.kind === 'failed'
                ? s.message
                : 'Jeszcze nic nie wytłumaczyłem. Wpisz /wytlumacz albo /wytlumacz ostatnie, żeby podsumować poprzednią sesję.'}
          </Text>
          {all.length > 0 && <Button key="history" label="📖 Zapisane wyjaśnienia" onPress={() => void showHistory($)} />}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">🧩 {shown.label}</Text>
        <Box marginBottom={1}><Text dimColor>
          {shown.project} · {when(shown.at)} · {i + 1} z {all.length}
        </Text></Box>
        {sections(shown.text).map(({ title, body }, n) => {
          const look = STYLE.find(st => st.match.test(title)) ?? FALLBACK
          return (
            <Box key={`s${n}`} flexDirection="column">
              {n > 0 && <Text dimColor>{rule}</Text>}
              <Text bold color={look.color}>{look.emoji} {title}</Text>
              <Box marginBottom={1}><Text>{body}</Text></Box>
            </Box>
          )
        })}
        <Text dimColor>📚 Poznane słówka: {await read($, learnedCount)}</Text>
        <Box>
          {i > 0 && <Button key="older" label="◀ Starsze" onPress={() => update($, viewing, v => Math.max(0, v - 1))} />}
          {i < all.length - 1 && (
            <Button key="newer" label="Nowsze ▶" onPress={() => update($, viewing, v => Math.min(all.length - 1, v + 1))} />
          )}
          <Button key="again" label="🔄 Wytłumacz ostatnie" onPress={() => start($, 'now')} />
          <Button key="recap" label="⏮ Poprzednia sesja" onPress={() => start($, 'last')} />
        </Box>
      </Box>
    )
  })
}
