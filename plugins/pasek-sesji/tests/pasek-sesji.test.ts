import { expect, test } from 'claude-code/testing'

const usage = (percent: number) => ({
  startedAt: 0,
  context: { tokens: percent * 10_000, window: 1_000_000, percent },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 9, resetsAt: new Date(110 * 60_000).toISOString() },
    { kind: 'seven_day', percentUsed: 36 },
  ],
  cost: { usd: 6.92 },
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Handoff pojawia się dopiero powyżej 35% kontekstu (${surface})`, {}, async ($, on) => {
    let percent = 24
    let ran = ''
    on('session.usage', () => ({ value: usage(percent) }))
    on('clock.now', () => ({ value: 60_000 }))
    on('session.cwd', () => ({ value: '/home/pawel/thumbforge' }))
    on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '', isStdoutTruncated: false } }))
    on('command.list', () => ({
      value: [
        { name: 'wytlumacz', description: '', source: 'plugin' },
        { name: 'mattpocock-skills:handoff', description: '', source: 'skills' },
      ] as any,
    }))
    on('command.run', ($, e) => { ran = e.command; return { text: '' } })

    const props = { hasSurvey: false, isWorking: false, maxRows: 20 } as any
    const ui = await $.ui.mount({ plugin: 'pasek-sesji', surface, component: 'AbovePrompt', props })
    expect(await ui.find({ key: 'handoff' })).toBeUndefined()
    expect(await ui.find({ key: 'wytlumacz' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /24%/ })).toBeDefined()

    percent = 36
    await ui.redraw(props)
    expect(await ui.find({ key: 'handoff' })).toBeDefined()
    await ui.press({ key: 'handoff' })
    expect(ran).toBe('mattpocock-skills:handoff')

    await ui.press({ key: 'wytlumacz' })
    expect(ran).toBe('wytlumacz')
    await ui.unmount()
  })
}
