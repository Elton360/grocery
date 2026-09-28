import { useEffect, useState } from 'react'

/**
 * useState backed by chrome.storage.session, so an unsubmitted review survives closing and reopening
 * the panel (cleared when the browser closes). `ready` is false until the stored value has loaded.
 */
export function useSessionState(key, initial) {
  const [value, setValue] = useState(initial)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    chrome.storage.session.get(key).then((stored) => {
      if (stored[key] !== undefined) setValue(stored[key])
      setReady(true)
    })
  }, [key])

  useEffect(() => {
    if (!ready) return
    if (value === null || value === undefined)
      chrome.storage.session.remove(key)
    else chrome.storage.session.set({ [key]: value })
  }, [key, value, ready])

  return [value, setValue, ready]
}
