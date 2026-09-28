import { useEffect, useState } from 'react'

import { plural } from '../../shared/format.js'
import { api } from './api.js'
import { ReviewPanel } from './components/ReviewPanel.jsx'
import { BACKEND } from './config.js'
import { useActiveTab } from './hooks/useActiveTab.js'
import { useReview } from './hooks/useReview.js'
import { siteFor } from './sites.js'

/** Open a web app page in a regular tab (only when asked). */
const openPage = (path) => chrome.tabs.create({ url: BACKEND + path })

async function runGrabber(tab, grabber) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN', // Instacart/Aldi product ids live in React fiber props on the page
    files: [`grabbers/${grabber}.js`],
  })
  const grab = res?.result
  if (!grab || grab.error)
    throw new Error(grab?.error || 'Grabber returned nothing')
  if (!grab.items?.length) throw new Error('No items found on this page')
  return grab
}

function useWaitingProposals(deps) {
  const [waiting, setWaiting] = useState(null)
  useEffect(() => {
    api
      .proposals('proposed')
      .then((d) => setWaiting(d.proposals.length))
      .catch(() => setWaiting(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return waiting
}

export function App() {
  const tab = useActiveTab()
  const site = tab?.url ? siteFor(tab.url) : null
  const r = useReview()
  const [grabbing, setGrabbing] = useState(false)
  const waiting = useWaitingProposals([r.notice?.saved])

  async function grab(action) {
    setGrabbing(true)
    r.setNotice(null)
    try {
      r.start(await runGrabber(tab, action.grabber))
    } catch (e) {
      r.setNotice({ error: true, text: e.message })
    } finally {
      setGrabbing(false)
    }
  }

  const reviewing = Boolean(r.review)
  return (
    <main>
      <header>
        <b>Grocery Grabber</b>
        <nav>
          <button className="link" onClick={() => openPage('/compare')}>
            Compare
          </button>
          <button className="link" onClick={() => openPage('/list')}>
            List
          </button>
          <button className="link" onClick={() => openPage('/review')}>
            Review{waiting ? ` (${waiting})` : ''}
          </button>
        </nav>
      </header>

      <section className="site">
        <h2>{site ? site.name : 'This tab'}</h2>
        {site ? (
          site.actions.map((a) => (
            <div className="action" key={a.label}>
              <button onClick={() => grab(a)} disabled={grabbing || reviewing}>
                {a.label}
              </button>
              <span className="small">{a.hint}</span>
            </div>
          ))
        ) : (
          <p className="small">
            Open a Walmart order or cart, your Instacart (Costco) cart, or your
            Aldi list.
          </p>
        )}
        <div className="action">
          <button
            onClick={() =>
              r.start({
                store: 'costco',
                source: 'receipt',
                paste: true,
                items: [],
              })
            }
            disabled={reviewing}
          >
            Paste Costco receipt
          </button>
        </div>
        {reviewing && (
          <p className="small">
            Submit or discard the review below before grabbing again.
          </p>
        )}
      </section>

      {r.notice && (
        <p className={`notice${r.notice.error ? ' err' : ''}`}>
          {r.notice.text}
          {r.notice.saved && (
            <>
              {' '}
              <button className="link" onClick={() => openPage('/list')}>
                View pending
              </button>
            </>
          )}
        </p>
      )}

      {r.ready && r.review && (
        <ReviewPanel
          review={r.review}
          busy={r.busy}
          onPaste={r.setPaste}
          onDate={r.setDate}
          onToggle={r.toggle}
          onToggleAll={r.toggleAll}
          onSubmit={r.submit}
          onDiscard={r.discard}
        />
      )}
      {waiting > 0 && !reviewing && (
        <p className="small">
          {plural(waiting, 'proposal')} waiting for review.{' '}
          <button className="link" onClick={() => openPage('/review')}>
            Review
          </button>
        </p>
      )}
    </main>
  )
}
