import { useCallback, useEffect, useState } from 'react'

import { plural } from '../../shared/format.js'
import { Header } from './components/Header.jsx'
import { Toast } from './components/Toast.jsx'
import { useActiveTab } from './hooks/useActiveTab.js'
import { useBackendLive } from './hooks/useBackendLive.js'
import { useFeed } from './hooks/useFeed.js'
import { useStoredState } from './hooks/useStoredState.js'
import { refreshInfo, siteFor } from './sites.js'
import { FeedView } from './views/FeedView.jsx'
import { MainView } from './views/MainView.jsx'
import { ReceiptView } from './views/ReceiptView.jsx'

async function runGrabber(tab, grabber) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN', // Instacart/Aldi product ids live in React fiber props on the page
    files: [`grabbers/${grabber}.js`],
  })
  const grab = res?.result
  if (grab) grab.grabber = grabber
  if (!grab || grab.error)
    throw new Error(grab?.error || 'Grabber returned nothing')
  if (grab.source === 'cart' && !grab.order_date) {
    grab.order_date = new Date().toLocaleDateString('en-CA')
  }
  return grab
}

export function App() {
  const tab = useActiveTab()
  const site = tab?.url ? siteFor(tab.url) : null
  const live = useBackendLive()
  const { feed, ready, importGrab, addToList, omit, restore, recheck } =
    useFeed()
  const [view, setView] = useStoredState('session', 'view', 'main')
  const [feedTab, setFeedTab] = useStoredState('session', 'feedTab', 'new')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (live) recheck().catch(() => {})
  }, [live, recheck])

  async function doImport(getGrab) {
    setBusy(true)
    try {
      const counts = await importGrab(await getGrab())
      setFeedTab('new')
      setView('feed')
      setToast({
        text: `Imported: ${plural(counts.new, 'new item')}, ${counts.tracked} already on My List, ${counts.omitted} omitted`,
      })
    } catch (e) {
      setToast({ error: true, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  const pendingNew = feed.items.filter((f) => f.status === 'new').length
  const latest = Object.values(feed.captures).sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  )[0]
  const refresh = {
    ...refreshInfo(latest, tab?.url),
    busy,
    run: () => doImport(() => runGrabber(tab, latest.grabber)),
  }
  return (
    <div className="side-panel">
      <Header
        subtitle={view === 'feed' ? 'Capture Feed' : 'Import & shop'}
        onHome={view === 'main' ? undefined : () => setView('main')}
      />
      {view === 'feed' && (
        <FeedView
          feed={feed}
          ready={ready}
          live={live}
          refresh={refresh}
          tab={feedTab}
          onTab={setFeedTab}
          actions={{ addToList, omit, restore }}
          notify={setToast}
        />
      )}
      {view === 'paste' && (
        <ReceiptView
          busy={busy}
          onCancel={() => setView('main')}
          onImport={(grab) => doImport(() => grab)}
        />
      )}
      {view === 'main' && (
        <MainView
          site={site}
          busy={busy}
          pendingNew={pendingNew}
          onImport={(grabber) => doImport(() => runGrabber(tab, grabber))}
          onPaste={() => setView('paste')}
          onFeed={() => setView('feed')}
        />
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}
