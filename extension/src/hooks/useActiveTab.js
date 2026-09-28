import { useEffect, useState } from 'react'

/** The active tab of the side panel's window; follows tab switches and navigations. */
export function useActiveTab() {
  const [tab, setTab] = useState(null)

  useEffect(() => {
    let windowId = null
    const refresh = async () => {
      if (windowId === null) windowId = (await chrome.windows.getCurrent()).id
      const [t] = await chrome.tabs.query({ active: true, windowId })
      setTab(t ?? null)
    }
    const onActivated = (info) => {
      if (info.windowId === windowId) refresh()
    }
    const onUpdated = (tabId, change, t) => {
      if (
        t.active &&
        t.windowId === windowId &&
        (change.url || change.status === 'complete')
      )
        refresh()
    }
    refresh()
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [])

  return tab
}
