/** Minimal client-side routing (three pages); swap for a router library if the app grows. */
import { useEffect, useState } from 'react'

// Old page names (extension v1, python backend) keep working.
const ALIASES = { '/': '/compare', '/pending': '/list', '/converge': '/review' }
const normalize = (path) => {
  const p = path.replace(/\.html$/, '')
  return ALIASES[p] ?? p
}

export function navigate(to) {
  window.history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function usePath() {
  const [path, setPath] = useState(() => normalize(window.location.pathname))
  useEffect(() => {
    const onPop = () => setPath(normalize(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return path
}
