import { isDesktopRuntime } from '../api/config'

export type AppCapabilities = {
  desktop: boolean
  offlineStorage: boolean
  nativeUpdater: boolean
  deepLinks: boolean
  filesystem: boolean
  localBackups: boolean
  nativeNotifications: boolean
  systemTray: boolean
  cloudSync: boolean
  collaboration: boolean
  webAuth: boolean
}

const desktop = isDesktopRuntime()

export const capabilities: Readonly<AppCapabilities> = Object.freeze({
  desktop,
  offlineStorage: true,
  nativeUpdater: desktop,
  deepLinks: desktop,
  filesystem: desktop,
  localBackups: true,
  nativeNotifications: desktop,
  systemTray: desktop,
  cloudSync: true,
  collaboration: true,
  webAuth: true,
})

export function hasCapability(capability: keyof AppCapabilities) {
  return capabilities[capability]
}
