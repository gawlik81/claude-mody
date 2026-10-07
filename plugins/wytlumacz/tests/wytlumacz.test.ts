import { expect, test } from 'claude-code/testing'

test('podsumowuje poprzednią sesję po polsku i zapamiętuje słówka', {}, async ($, on) => {
  let asked = ''
  const store = new Map<string, unknown>()
  on('store.get', ($, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('prompt.submit', ($, e: any) => ({ text: e.text }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/home/pawel/thumbforge' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.call', () => ({ result: 'ran' }))
  on('turn.complete', () => ({ text: 'Dodałem webhook.' }))
  on('model.complete', ($, e) => {
    asked = e.prompt
    return {
      value: {
        isAnswered: true,
        text: 'W SKRÓCIE — Dodano webhook.\nCO SIĘ STAŁO\n1. Dodałem webhook.\nSŁÓWKA\n- Webhook - dzwonek do drzwi - powiadamia o końcu runu\nTERAZ ZRÓB\nNic - wszystko gotowe.',
        usage: {},
      },
    }
  })

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
  await $.prompt.submit({ text: 'dodaj webhook' } as any)
  await $.tool.call({ tool: 'Edit', file_path: '/work/hook.ts', old_string: 'a', new_string: 'b' } as any)
  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1 } as any)

  await new Promise(r => setTimeout(r, 5))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
  await $.command.run({ command: 'wytlumacz', args: 'ostatnie' } as any)
  await new Promise(r => setTimeout(r, 50))

  expect(asked).toContain('Odpowiedz WYŁĄCZNIE po polsku')
  expect(asked).toContain('Prosiłem: dodaj webhook')
  expect(asked).toContain('Zmienił plik: /work/hook.ts')
  expect((store.get('saved-explanations') as any[]).at(-1).label).toContain('Podsumowanie')
  expect(store.get('learned-terms')).toEqual(['Webhook'])
})
