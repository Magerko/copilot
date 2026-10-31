import { contextBridge, ipcRenderer } from 'electron'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(channel, ...args)) as { ok: true; value: T } | { ok: false; error: string }
  if (!r.ok) throw new Error(r.error)
  return r.value
}

function on(channel: string) {
  return (cb: (payload: unknown) => void) => {
    const fn = (_e: unknown, payload: unknown) => cb(payload)
    ipcRenderer.on(channel, fn)
    return () => {
      ipcRenderer.removeListener(channel, fn)
    }
  }
}

const api = {
  invoke,
  platform: process.platform,
  onSnapshot: on('km:snapshot'),
  onSettings: on('km:settings'),
  onAsr: on('km:asr'),
  onCapture: on('km:capture'),
  onScroll: on('km:scroll'),
  onPickerInit: on('km:picker-init'),
  sendAudio: (m: unknown) => ipcRenderer.send('km:audio', m),
  sendLevel: (m: unknown) => ipcRenderer.send('km:level', m),
  sendAudioStatus: (m: unknown) => ipcRenderer.send('km:audio-status', m)
}

export type KmBridge = typeof api

contextBridge.exposeInMainWorld('km', api)

// CSP stops renderer requests before webRequest sees them, so I report them to keep the network log complete.
document.addEventListener('securitypolicyviolation', (e) => ipcRenderer.send('km:csp', { url: e.blockedURI, directive: e.effectiveDirective }))
