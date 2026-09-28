import { useEffect } from 'react'

/** Brief message at the bottom of the panel; clears itself. */
export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(onDone, toast.error ? 6000 : 2500)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  return (
    <div className={`toast${toast.error ? ' error' : ''}`} role="status">
      {toast.text}
    </div>
  )
}
