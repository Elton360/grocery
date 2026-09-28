import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'

const POLL_MS = 3000

/**
 * Headless converge run state, polled while running. `waiting` = proposals waiting for review.
 * onFinished runs once when a run ends (e.g. to reload the pending list).
 */
export function useConvergeStatus(onFinished) {
  const [status, setStatus] = useState(null)
  const [waiting, setWaiting] = useState(0)
  const [error, setError] = useState(null)
  const timer = useRef(null)
  const lastState = useRef(null)
  const finished = useRef(onFinished)
  useEffect(() => {
    finished.current = onFinished
  })

  const poll = useCallback(async () => {
    clearTimeout(timer.current)
    try {
      const st = await api.convergeStatus()
      if (lastState.current === 'running' && st.state !== 'running')
        finished.current?.()
      lastState.current = st.state
      setStatus(st)
      if (st.state === 'running') timer.current = setTimeout(poll, POLL_MS)
      else setWaiting((await api.proposals('proposed')).proposals.length)
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [])

  useEffect(() => {
    poll()
    return () => clearTimeout(timer.current)
  }, [poll])

  const start = useCallback(async () => {
    try {
      const st = await api.startConverge()
      lastState.current = st.state
      setStatus(st)
      if (st.state === 'running') timer.current = setTimeout(poll, POLL_MS)
    } catch (e) {
      setError(e)
    }
  }, [poll])

  return { status, waiting, error, start }
}
