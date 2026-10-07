export type Status = { kind: 'idle' | 'writing' | 'failed'; message: string }
/** Jedno wyjaśnienie, trzymane między sesjami do ponownego czytania. */
export type Saved = { at: number; project: string; label: string; text: string }
/** Co zrobiła jedna tura, żeby późniejsza sesja mogła ją podsumować. */
export type Turn = { at: number; session: number; project: string; prompt: string; actions: string[]; answer: string }

declare module 'claude-code' {
  interface PluginState {
    'wytlumacz': {
      status: Status
      saved: Saved[]
      viewing: number
      hasChanges: boolean
      hasRecap: boolean
      didThings: boolean
      actions: string[]
      prompt: string
      sessionStartedAt: number
      learnedCount: number
    }
  }
}
