import { useCallback, useEffect, useRef } from 'react'

import { api } from '../api.js'
import { useStoredState } from './useStoredState.js'

/**
 * The capture feed: everything imported in the panel, across stores, until cleared.
 * Persisted in chrome.storage.local as { captures: {id: capture}, items: [feedItem] }.
 *
 *   capture   { id, store, source, order_date, page_url, price_mode, captured_at, grabber }
 *   feedItem  { key, captureId, store, item (as grabbed), status: 'new' | 'tracked' | 'omitted', checked }
 *
 * Status comes from the backend: never seen → new; pending or on the list → tracked (it is on My List);
 * ignored → omitted. `checked` is false while the backend couldn't be asked (offline import).
 *
 * A capture is (re)submitted to the backend with all of its tracked items whenever that set changes.
 * `capture_key` makes each re-submit replace the previous one, so price history isn't duplicated.
 */
const EMPTY = { captures: {}, items: [] }
const BACKEND_STATUS = {
  new: 'new',
  pending: 'tracked',
  converged: 'tracked',
  ignored: 'omitted',
}

export const itemKey = (store, it) =>
  `${store}:${it.store_product_id || `name:${it.name}`}`

async function checkStatuses(store, items) {
  const ids = items.map((it) => it.store_product_id).filter(Boolean)
  const { status } = ids.length ? await api.check(store, ids) : { status: {} }
  return (it) =>
    it.store_product_id ? BACKEND_STATUS[status[it.store_product_id]] : 'new'
}

function submitCapture(capture, items) {
  const tracked = items
    .filter((f) => f.captureId === capture.id && f.status === 'tracked')
    .map((f) => f.item)
  if (!tracked.length) return Promise.resolve(null)
  return api.saveGrab({
    store: capture.store,
    source: capture.source,
    order_date: capture.order_date,
    page_url: capture.page_url || '',
    price_mode: capture.price_mode,
    capture_key: capture.id,
    items: tracked,
  })
}

export function useFeed() {
  const [feed, setFeed, ready] = useStoredState('local', 'feed', EMPTY)
  const feedRef = useRef(feed)
  useEffect(() => {
    feedRef.current = feed
  }, [feed])

  /** Add a grab to the feed; returns counts per status. Throws if the grab has no items. */
  const importGrab = useCallback(
    async (grab) => {
      if (!grab.items?.length) throw new Error('No items found on this page')
      const capture = {
        id: crypto.randomUUID(),
        store: grab.store,
        source: grab.source,
        order_date: grab.order_date,
        page_url: grab.page_url || '',
        price_mode:
          grab.price_mode || (grab.store === 'costco' ? 'in_store' : null),
        captured_at: new Date().toISOString(),
        grabber: grab.grabber ?? null, // for Refresh; null for pasted receipts
      }
      let statusOf = null
      try {
        statusOf = await checkStatuses(grab.store, grab.items)
      } catch {
        // offline: import anyway as new, re-check later
      }
      const incoming = grab.items.map((item) => ({
        key: itemKey(grab.store, item),
        captureId: capture.id,
        store: grab.store,
        item,
        status: statusOf ? statusOf(item) : 'new',
        checked: Boolean(statusOf),
      }))
      const keys = new Set(incoming.map((f) => f.key))
      const next = {
        captures: { ...feedRef.current.captures, [capture.id]: capture },
        // newest first; a re-captured item replaces its older entry
        items: [
          ...incoming,
          ...feedRef.current.items.filter((f) => !keys.has(f.key)),
        ],
      }
      setFeed(next)
      // items already on My List: record this capture's prices right away
      if (statusOf) await submitCapture(capture, next.items).catch(() => {})
      const count = (s) => incoming.filter((f) => f.status === s).length
      return {
        new: count('new'),
        tracked: count('tracked'),
        omitted: count('omitted'),
      }
    },
    [setFeed],
  )

  /** Move items to Tracked and submit their captures (they become pending on My List). */
  const addToList = useCallback(
    async (keys) => {
      const wanted = new Set(keys)
      const prev = feedRef.current
      const items = prev.items.map((f) =>
        wanted.has(f.key) ? { ...f, status: 'tracked' } : f,
      )
      const captureIds = new Set(
        items.filter((f) => wanted.has(f.key)).map((f) => f.captureId),
      )
      for (const id of captureIds) {
        await submitCapture(prev.captures[id], items)
      }
      setFeed({ ...prev, items })
    },
    [setFeed],
  )

  /** Omit: remember as ignored in the backend, so future imports skip it. */
  const omit = useCallback(
    async (key) => {
      const f = feedRef.current.items.find((x) => x.key === key)
      await api.ignore(f.store, [f.item])
      setFeed((prev) => ({
        ...prev,
        items: prev.items.map((x) =>
          x.key === key ? { ...x, status: 'omitted' } : x,
        ),
      }))
    },
    [setFeed],
  )

  /** Undo an omit by adding the item to My List (pending). */
  const restore = useCallback(
    async (key) => {
      const prev = feedRef.current
      const f = prev.items.find((x) => x.key === key)
      if (f.item.store_product_id) {
        await api.setItemStatus(f.store, f.item.store_product_id, 'restore')
      }
      const items = prev.items.map((x) =>
        x.key === key ? { ...x, status: 'tracked' } : x,
      )
      await submitCapture(prev.captures[f.captureId], items)
      setFeed({ ...prev, items })
    },
    [setFeed],
  )

  /** Re-ask the backend about items imported while it was offline. */
  const recheck = useCallback(async () => {
    const unchecked = feedRef.current.items.filter((f) => !f.checked)
    if (!unchecked.length) return
    const byStore = Object.groupBy(unchecked, (f) => f.store)
    const updates = new Map()
    for (const [store, list] of Object.entries(byStore)) {
      const statusOf = await checkStatuses(
        store,
        list.map((f) => f.item),
      )
      for (const f of list) updates.set(f.key, statusOf(f.item))
    }
    setFeed((prev) => ({
      ...prev,
      items: prev.items.map((f) =>
        updates.has(f.key)
          ? { ...f, status: updates.get(f.key), checked: true }
          : f,
      ),
    }))
  }, [setFeed])

  const clear = useCallback(() => setFeed(EMPTY), [setFeed])

  return { feed, ready, importGrab, addToList, omit, restore, recheck, clear }
}
