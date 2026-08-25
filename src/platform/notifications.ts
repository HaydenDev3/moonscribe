import { isDesktopRuntime } from '../api/config'

export async function notifyDesktop(title: string, body: string) {
  if (isDesktopRuntime()) {
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification')
      let permission = await isPermissionGranted()
      if (!permission) permission = (await requestPermission()) === 'granted'
      if (permission) {
        sendNotification({ title, body })
        return true
      }
    } catch {
      // Fall through to the browser notification path when the native plugin
      // is unavailable in a development shell or older desktop build.
    }
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  new Notification(title, { body })
  return true
}
