import { shell, systemPreferences } from 'electron'

export type MediaAccess = 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown'

export interface MediaAccessReport {
  /** false where the OS does not gate capture per app (Windows), so the UI shows nothing. */
  gated: boolean
  microphone: MediaAccess
  screen: MediaAccess
}

// Privacy panes in System Settings; the anchors have been stable since macOS 10.15.
const PANES = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
} as const

export function mediaAccess(platform: NodeJS.Platform = process.platform): MediaAccessReport {
  if (platform !== 'darwin') return { gated: false, microphone: 'granted', screen: 'granted' }
  return {
    gated: true,
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    screen: systemPreferences.getMediaAccessStatus('screen')
  }
}

/** macOS shows the microphone prompt only once; later calls just report the stored answer. */
export async function ensureMicrophone(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return true
  return systemPreferences.askForMediaAccess('microphone')
}

export function openPrivacyPane(kind: keyof typeof PANES): void {
  if (process.platform === 'darwin') void shell.openExternal(PANES[kind])
}
