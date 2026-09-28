import { useEffect, useState } from 'react'

import { api } from '../api.js'

const POLL_MS = 15000

/** Whether the local backend answers (the "Live" / "Paused" indicator). null until the first check. */
export function useBackendLive() {
  const [live, setLive] = useState(null)
  useEffect(() => {
    let timer
    const check = () =>
      api
        .health()
        .then(() => setLive(true))
        .catch(() => setLive(false))
        .finally(() => {
          timer = setTimeout(check, POLL_MS)
        })
    check()
    return () => clearTimeout(timer)
  }, [])
  return live
}
