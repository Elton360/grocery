import { useCallback, useEffect, useRef, useState } from 'react'

import { plural, today } from '../../../shared/format.js'
import { parseReceipt } from '../../../shared/receipt.js'
import { api } from '../api.js'
import { useSessionState } from './useSessionState.js'

// Row status from /api/check: 'new' | 'pending' | 'converged' | 'ignored' ('' until checked)
export const onList = (r) => r.status === 'pending' || r.status === 'converged'
export const isIgnored = (r) => r.status === 'ignored'
export const isNew = (r) => !onList(r) && !isIgnored(r)

const toRows = (items) =>
  items.map((item) => ({ item, keep: true, restore: false, status: '' }))

/**
 * The grab being reviewed: grab → check against the curated list → keep/uncheck → submit.
 * Lives in session storage until submitted or discarded. `notice` = {text, error} shown in the panel.
 */
export function useReview() {
  const [review, setReview, ready] = useSessionState('review', null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const checked = useRef(null)

  const updateRows = useCallback(
    (fn) => setReview((r) => (r ? { ...r, rows: fn(r.rows) } : r)),
    [setReview],
  )

  // Check new rows against the curated list, pending items and the ignore list.
  useEffect(() => {
    if (!review) return
    const ids = review.rows
      .filter((r) => !r.status && r.item.store_product_id)
      .map((r) => r.item.store_product_id)
    const key = `${review.grab.store}:${ids.join(',')}`
    if (!ids.length || checked.current === key) return
    checked.current = key
    api
      .check(review.grab.store, ids)
      .then(({ status }) => {
        updateRows((rows) =>
          rows.map((r) =>
            r.status
              ? r
              : { ...r, status: status[r.item.store_product_id] || 'new' },
          ),
        )
        setNotice((n) => (n?.offline ? null : n))
      })
      .catch((e) => {
        checked.current = null
        setNotice({ error: true, offline: true, text: e.message })
      })
  }, [review, updateRows])

  const start = useCallback(
    (grab) => {
      checked.current = null
      setNotice(null)
      setReview({
        grab: { ...grab, items: undefined },
        rows: toRows(grab.items || []),
        date: grab.order_date || (grab.source === 'cart' ? today() : ''),
        paste: grab.paste ? '' : null,
      })
    },
    [setReview],
  )

  const setPaste = useCallback(
    (text) => {
      const { items, bad } = parseReceipt(text)
      setReview((r) => ({ ...r, paste: text, rows: toRows(items), bad }))
    },
    [setReview],
  )

  const setDate = useCallback(
    (date) => setReview((r) => ({ ...r, date })),
    [setReview],
  )
  const toggle = useCallback(
    (i, field) =>
      updateRows((rows) =>
        rows.map((r, j) => (j === i ? { ...r, [field]: !r[field] } : r)),
      ),
    [updateRows],
  )
  const toggleAll = useCallback(
    (keep) =>
      updateRows((rows) => rows.map((r) => (isNew(r) ? { ...r, keep } : r))),
    [updateRows],
  )
  const discard = useCallback(() => {
    setReview(null)
    setNotice(null)
  }, [setReview])

  const submit = useCallback(async () => {
    const { grab, rows, date } = review
    if (!date) {
      setNotice({ error: true, text: 'Set the order date first.' })
      return
    }
    const restore = rows
      .filter((r) => isIgnored(r) && r.restore)
      .map((r) => r.item)
    const keep = rows
      .filter((r) => (isNew(r) && r.keep) || onList(r))
      .map((r) => r.item)
      .concat(restore)
    const removed = rows.filter((r) => isNew(r) && !r.keep).map((r) => r.item)
    setBusy(true)
    try {
      for (const it of restore)
        await api.setItemStatus(grab.store, it.store_product_id, 'restore')
      const res = await api.saveGrab({
        store: grab.store,
        source: grab.source,
        order_date: date,
        page_url: grab.page_url || '',
        price_mode:
          grab.price_mode || (grab.store === 'costco' ? 'in_store' : null),
        items: keep,
        removed,
      })
      setReview(null)
      setNotice({
        saved: true,
        text:
          `Saved: ${plural(res.new, 'new item')} added, ${plural(res.known, 'existing price')} updated, ` +
          `${res.removed} removed${res.replaced ? ' (replaced the earlier grab of this order)' : ''}.`,
      })
    } catch (e) {
      setNotice({
        error: true,
        text: `${e.message} Your rows are kept — press Submit again.`,
      })
    } finally {
      setBusy(false)
    }
  }, [review, setReview])

  return {
    review,
    ready,
    notice,
    setNotice,
    busy,
    start,
    setPaste,
    setDate,
    toggle,
    toggleAll,
    discard,
    submit,
  }
}
