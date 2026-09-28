import { useCallback, useEffect, useState } from 'react'

/** Load data from `fetcher` whenever `deps` change; exposes reload and setData for optimistic updates. */
export function useLoad(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fetcher, deps)

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      setState({ data: await load(), error: null, loading: false })
    } catch (error) {
      setState({ data: null, error, loading: false })
    }
  }, [load])

  useEffect(() => {
    reload()
  }, [reload])

  const setData = useCallback((update) => {
    setState((s) => ({
      ...s,
      data: typeof update === 'function' ? update(s.data) : update,
    }))
  }, [])

  return { ...state, reload, setData }
}
