// Pasek sesji: karta nad promptem z najważniejszymi liczbami sesji.
// - Wiersz 1: projekt · gałąź · wiek sesji · liczba promptów · koszt
//            | ostatnia odpowiedź · model · trafienie w cache · odliczanie cache
// - Wiersz 2: paski kontekstu, limitu 5h i tygodniowego (z czasem do resetu)
//            oraz przyciski: Handoff (gdy kontekst > progu) i Wytłumacz.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { LastTurn } from '../types'

const tick = atom({ plugin: 'pasek-sesji', key: 'tick' } as const, 0)
const prompts = atom({ plugin: 'pasek-sesji', key: 'prompts' } as const, 0)
const branch = atom({ plugin: 'pasek-sesji', key: 'branch' } as const, '')
const last = atom({ plugin: 'pasek-sesji', key: 'last' } as const, null)

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function num(v: unknown, fallback: number) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function bar(percent: number, width = 8) {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function barColor(percent: number) {
  return percent >= 80 ? 'red' : percent >= 50 ? 'yellow' : 'blue'
}

function tokens(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

/** 3d 7h · 1h 50m · 12m · 6s */
function span(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function shortModel(id: string) {
  return id.replace(/^claude-/, '').replace(/-\d{8}$/, '').replace(/\[.*\]$/, '')
}

function windowOf(limits: SessionRateLimit[], kind: string) {
  return limits.find(l => l.kind === kind)
}

async function readBranch($: EngineInterface) {
  try {
    const r = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 3000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

/** Komenda skilla po nazwie, także z prefiksem pluginu (np. `moj-plugin:session-handoff-prompt`). */
async function findCommand($: EngineInterface, name: string) {
  const all = await $.command.list()
  return (
    all.find(c => c.name === name) ??
    all.find(c => c.name.endsWith(`:${name}`))
  )?.name
}

async function runSkill($: EngineInterface, name: string, missing: string) {
  const cmd = await findCommand($, name)
  if (!cmd) {
    $.ui.toast(missing)
    return
  }
  await $.command.run({ command: cmd })
}

export const register: Register = (on, options) => {
  const threshold = num(options?.progHandoff, 35)
  const handoffSkill = String(options?.skillHandoff ?? 'session-handoff-prompt').replace(/^\//, '')
  const cacheTtl = num(options?.cacheTtlMin, 60) * MIN

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await update($, branch, () => '')
    void readBranch($).then(b => update($, branch, () => b))
    // Odświeża „last Xs” i odliczanie cache bez czekania na kolejną turę.
    $.clock.every(5000, () => void update($, tick, t => t + 1))
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, prompts, n => n + 1)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    const u = result.usage ?? e.usage
    const prev = await read($, last)
    const entry: LastTurn = {
      at: await $.clock.now(),
      model: u?.model ? shortModel(u.model) : (prev?.model ?? ''),
      hitPercent: null,
    }
    if (u) {
      const total = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      entry.hitPercent = total > 0 ? Math.round((u.cache_read_input_tokens / total) * 100) : null
    }
    await update($, last, () => entry)
    void readBranch($).then(b => update($, branch, () => b))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    await read($, tick)

    const now = await $.clock.now()
    const usage = await $.session.usage()
    const cwd = await $.session.cwd()
    const project = cwd.split('/').filter(Boolean).pop() ?? cwd
    const br = await read($, branch)
    const count = await read($, prompts)
    const lt = await read($, last)

    const ctxPct = usage.context.percent ?? 0
    const ctxTok = usage.context.tokens ?? 0
    const five = windowOf(usage.rateLimits, 'five_hour')
    const week = windowOf(usage.rateLimits, 'seven_day')
    const resetIn = (w?: SessionRateLimit) => (w?.resetsAt ? ` ↻${span(Date.parse(w.resetsAt) - now)}` : '')

    const cacheLeft = lt ? cacheTtl - (now - lt.at) : 0
    const cacheBar = lt && cacheLeft > 0 ? '▬'.repeat(Math.max(1, Math.round((cacheLeft / cacheTtl) * 6))) : ''

    const showHandoff = ctxPct > threshold

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Box justifyContent="space-between">
          <Text>
            <Text bold>{project}</Text>
            {br ? <Text color="green"> ⎇ {br}</Text> : ''}
            <Text dimColor>
              {' · '}{span(now - usage.startedAt)} · {count} {count === 1 ? 'prompt' : 'prompty'}
              {usage.cost ? ` · $${usage.cost.usd.toFixed(2)}` : ''}
            </Text>
          </Text>
          <Text dimColor>
            {lt ? `last ${span(now - lt.at)}` : 'last —'}
            {lt?.model ? ` · ${lt.model}` : ''}
            {lt?.hitPercent != null ? ` · hit ${lt.hitPercent}%` : ''}
            {' · cache '}
            {cacheBar ? <Text color="green">{cacheBar}</Text> : <Text color="red">zimny</Text>}
            {cacheBar ? ` ${Math.ceil(cacheLeft / MIN)}m` : ''}
          </Text>
        </Box>
        <Box justifyContent="space-between">
          <Text>
            <Text dimColor>ctx </Text>
            <Text color={barColor(ctxPct)}>{bar(ctxPct)}</Text>
            <Text> {ctxPct}% </Text>
            <Text dimColor>{tokens(ctxTok)}/{tokens(usage.context.window)}</Text>
            {five ? (
              <Text>
                <Text dimColor>   5h </Text>
                <Text color={barColor(five.percentUsed)}>{bar(five.percentUsed)}</Text>
                <Text> {Math.round(five.percentUsed)}%</Text>
                <Text dimColor>{resetIn(five)}</Text>
              </Text>
            ) : ''}
            {week ? (
              <Text>
                <Text dimColor>   week </Text>
                <Text color={barColor(week.percentUsed)}>{bar(week.percentUsed)}</Text>
                <Text> {Math.round(week.percentUsed)}%</Text>
                <Text dimColor>{resetIn(week)}</Text>
              </Text>
            ) : ''}
          </Text>
          <Box>
            {showHandoff && (
              <Button key="handoff" label="Handoff" hotkey="h" onPress={() => runSkill($, handoffSkill, `Nie znaleziono skilla /${handoffSkill}`)} />
            )}
            <Button key="wytlumacz" label="Wytłumacz" hotkey="w" onPress={() => runSkill($, 'wytlumacz', 'Brak moda „Wytłumacz” — zainstaluj go, żeby działał ten przycisk')} />
          </Box>
        </Box>
      </Box>
    )
  })
}
