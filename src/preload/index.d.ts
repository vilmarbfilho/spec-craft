import type { SpecCraftApi } from './index'

declare global {
  interface Window {
    api: SpecCraftApi
  }
}

export {}
