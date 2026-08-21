declare module 'virtual:pwa-register' {
  export function registerSW(options?: { immediate?: boolean }): {
    offlineReady: boolean
    needRefresh: boolean
  }
}
