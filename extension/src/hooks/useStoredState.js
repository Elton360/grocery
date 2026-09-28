import { useEffect, useState } from 'react'

/**
 * useState persisted in chrome.storage (`local` survives browser restarts, `session` doesn't).
 * `ready` is false until the stored value has loaded.
 */
export function useStoredState(area, key, initial) {
  const [value, setValue] = useState(initial)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    chrome.storage[area].get(key).then((stored) => {
      if (stored[key] !== undefined) setValue(stored[key])
      setReady(true)
    })
  }, [area, key])

  useEffect(() => {
    if (ready) chrome.storage[area].set({ [key]: value })
  }, [area, key, value, ready])

  return [value, setValue, ready]
}
