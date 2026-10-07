/** Ostatnia odpowiedź modelu: kiedy przyszła, który model i trafienie w cache. */
export type LastTurn = { at: number; model: string; hitPercent: number | null }

declare module 'claude-code' {
  interface PluginState {
    'pasek-sesji': {
      tick: number
      prompts: number
      branch: string
      last: LastTurn | null
    }
  }
}
