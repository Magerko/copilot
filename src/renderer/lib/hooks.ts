import { useEffect, useState } from 'react'
import type { AppSnapshot, AsrStatus, Settings } from '@shared/types'
import { km } from './api'

// Seed arrives asynchronously (km:getState); a later seed must not clobber a newer push.
function useFeed<T>(initial: T | null, subscribe: (cb: (v: T) => void) => () => void): [T | null, (v: T) => void] {
  const [v, setV] = useState(initial)
  useEffect(() => {
    if (initial) setV((cur) => cur ?? initial)
  }, [initial])
  useEffect(() => subscribe((x) => setV(x)), [subscribe])
  return [v, setV]
}

export const useSnapshot = (initial: AppSnapshot | null) => useFeed(initial, km.onSnapshot as never)[0] as AppSnapshot | null
export const useSettingsFeed = (initial: Settings | null) => useFeed<Settings>(initial, km.onSettings as never)
export const useAsrFeed = (initial: AsrStatus | null) => useFeed(initial, km.onAsr as never)[0] as AsrStatus | null
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): [T | null, () => void, string | null] {
  const [v, setV] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    fn()
      .then((r) => live && (setV(r), setErr(null)))
      .catch((e: Error) => live && setErr(e.message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return [v, () => setTick((t) => t + 1), err]
}
