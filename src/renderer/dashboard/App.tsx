import { useEffect, useRef, useState } from 'react'
import type { Settings } from '@shared/types'
import { api, km, type InitialState } from '../lib/api'
import { CaptureController } from '../lib/audio'
import { useAsrFeed, useSettingsFeed, useSnapshot } from '../lib/hooks'
import { setLang, t } from '../lib/i18n'
import { History } from './History'
import { Home } from './Home'
import { Live } from './Live'
import { Onboarding } from './Onboarding'
import { ProfilePage } from './ProfilePage'
import { SettingsPage } from './settings/SettingsPage'

export type Page = 'home' | 'live' | 'history' | 'profile' | 'settings'

export interface Ctx {
  init: InitialState
  settings: Settings
  patch: (p: Parameters<typeof api.patchSettings>[0]) => Promise<void>
  go: (p: Page, sub?: string) => void
}

export function App() {
  const [init, setInit] = useState<InitialState | null>(null)
  const [page, setPage] = useState<Page>('home')
  const [sub, setSub] = useState<string | undefined>()
  const snap = useSnapshot(init?.snapshot ?? null)
  const [settings, setSettings] = useSettingsFeed(init?.settings ?? null)
  const asr = useAsrFeed(init?.asr ?? null)
  const capture = useRef(new CaptureController())
  const settingsRef = useRef<Settings | null>(null)
  settingsRef.current = settings

  useEffect(() => {
    void api.state().then((s) => {
      setInit(s)
      setSettings(s.settings)
    })
  }, [setSettings])

  // t() is not reactive: I set the language during render, before any child builds its labels, so a switch applies at once.
  if (settings) setLang(settings.uiLang)
  useEffect(() => {
    if (!settings) return
    document.documentElement.dataset.theme = settings.overlay.theme === 'light' ? 'light' : 'dark'
  }, [settings])

  useEffect(
    () =>
      km.onCapture((m) => {
        const st = settingsRef.current
        if (!st) return
        if (m.action === 'start') {
          void capture.current.start({
            sessionId: m.sessionId,
            micDeviceId: st.audio.micDeviceId,
            captureMic: st.audio.captureMic && st.consent.mic,
            captureSystem: st.audio.captureSystem && st.consent.system
          })
          setPage('live')
        } else if (m.action === 'stop') void capture.current.stop()
        else if (m.action === 'pause') void capture.current.pause()
        else void capture.current.resume()
      }),
    []
  )

  // The overlay's mic / system-audio buttons flip these settings; I apply them to the running capture at once.
  const wantMic = !!settings && settings.audio.captureMic && settings.consent.mic
  const wantSystem = !!settings && settings.audio.captureSystem && settings.consent.system
  useEffect(() => {
    void capture.current.setSource('user', wantMic)
  }, [wantMic])
  useEffect(() => {
    void capture.current.setSource('remote', wantSystem)
  }, [wantSystem])

  if (!init || !settings || !snap) return <div className="boot">Copilot…</div>

  const patch = async (p: Parameters<typeof api.patchSettings>[0]) => {
    setSettings(await api.patchSettings(p))
  }
  const go = (p: Page, s?: string) => {
    setPage(p)
    setSub(s)
  }
  const ctx: Ctx = { init, settings, patch, go }

  if (!settings.onboarded) return <Onboarding ctx={ctx} asr={asr} />

  const nav: [Page, string][] = [
    ['home', 'Главная'],
    ['live', 'Сессия'],
    ['history', 'История'],
    ['profile', 'Профиль и документы'],
    ['settings', 'Настройки']
  ]

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">
            C<i />
          </span>
          <span>Copilot</span>
        </div>
        <nav>
          {nav.map(([p, label]) => (
            <button key={p} className={page === p ? 'on' : ''} onClick={() => go(p)}>
              {t(label)}
              {p === 'live' && snap.sessionId && <span className={`dot ${snap.listening ? 'ok' : 'warn'}`} />}
            </button>
          ))}
        </nav>
        <div className="grow" />
        <div className="side-foot">
          {snap.sessionId && (
            <button className="btn danger sm" onClick={() => void api.session.panic()} title={settings.shortcuts.panic}>
              {t('Аварийная остановка')}
            </button>
          )}
          <div className="faint small">
            v{init.version} · {settings.offline ? t('офлайн') : 'BYOK'}
          </div>
        </div>
      </aside>
      <main className="main scroll">
        {page === 'home' && <Home ctx={ctx} snap={snap} />}
        {page === 'live' && <Live ctx={ctx} snap={snap} />}
        {page === 'history' && <History />}
        {page === 'profile' && <ProfilePage ctx={ctx} />}
        {page === 'settings' && <SettingsPage ctx={ctx} snap={snap} asr={asr} tab={sub} />}
      </main>
    </div>
  )
}
