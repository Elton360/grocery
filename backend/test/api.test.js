/** HTTP behavior of the Express app on a scratch database built from fixtures/seed.sql. */
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { createApp } from '../src/app.js'
import { connect } from '../src/db.js'

import { golden, parity, scratchDb, scrub } from './helpers.js'

let server
let base
const HEADERS = { 'Content-Type': 'application/json', 'X-Grocery-Client': '1' }
const post = (path, body, headers = HEADERS) =>
  fetch(base + path, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

before(async () => {
  const db = connect(scratchDb())
  server = createApp(db).listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

test('GET /api/compare serves the same payload as the Python backend', async () => {
  const res = await fetch(`${base}/api/compare`)
  assert.equal(res.status, 200)
  assert.deepEqual(parity(scrub(await res.json()), golden('reads').compare), [])
})

test('POSTs without the client header are refused', async () => {
  const res = await post(
    '/api/grabs',
    {},
    { 'Content-Type': 'application/json' },
  )
  assert.equal(res.status, 403)
  assert.deepEqual(await res.json(), { error: 'missing client header' })
})

test('bad input is a 400 with the reason; unknown routes are 404', async () => {
  let res = await post('/api/grabs', { store: 'nope', source: 'cart' })
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'bad store/source: nope/cart' })
  res = await post('/api/grabs', '{not json')
  assert.equal(res.status, 400)
  res = await post('/api/proposals/99999/approve', {})
  assert.deepEqual(
    [res.status, await res.json()],
    [400, { error: 'proposal not found or already decided' }],
  )
  res = await fetch(`${base}/api/nope`)
  assert.equal(res.status, 404)
})

test('grab → check → remove/restore (ids with slashes) → pending list', async () => {
  let res = await post('/api/grabs', {
    store: 'walmart',
    source: 'cart',
    order_date: '2026-09-28',
    items: [
      { name: 'Mystery / Item', price_each: 1.5 },
      { store_product_id: 'a/b', name: 'Slashy', price_each: 2 },
    ],
  })
  assert.deepEqual(await res.json(), {
    grab_id: 7,
    replaced: false,
    new: 2,
    known: 0,
    ignored: 0,
    removed: 0,
  })
  res = await post('/api/check', { store: 'walmart', ids: ['a/b', 'wm-milk'] })
  assert.deepEqual(await res.json(), {
    status: { 'a/b': 'pending', 'wm-milk': 'converged' },
  })
  res = await post(
    `/api/pending/walmart/${encodeURIComponent('a/b')}/remove`,
    {},
  )
  assert.deepEqual([res.status, await res.json()], [200, { updated: 1 }])
  res = await post('/api/pending/walmart/name:mystery-item/restore', {})
  assert.deepEqual(await res.json(), { updated: 1 })
  res = await post('/api/pending/walmart/nope/remove', {})
  assert.equal(res.status, 404)
  const pending = await (await fetch(`${base}/api/pending`)).json()
  assert.deepEqual(
    pending.items.map((i) => i.store_product_id),
    ['cc-new-oil', 'ic-new-oil', 'wm-new-beans', 'name:mystery-item'],
  )
  const ignored = await (
    await fetch(`${base}/api/pending?status=ignored`)
  ).json()
  assert.ok(ignored.items.some((i) => i.store_product_id === 'a/b'))
})

test('converge run with nothing pending does not start Claude', async () => {
  const { items } = await (await fetch(`${base}/api/pending`)).json()
  for (const i of items) {
    await post(
      `/api/pending/${i.store}/${encodeURIComponent(i.store_product_id)}/remove`,
      {},
    )
  }
  // guard: never call /converge/run while anything is pending (it would launch Claude Code)
  const left = await (await fetch(`${base}/api/pending`)).json()
  assert.equal(left.items.length, 0)
  const res = await post('/api/converge/run', {})
  assert.deepEqual(await res.json(), {
    state: 'idle',
    message: 'Nothing pending — grab some orders or receipts first.',
  })
  assert.deepEqual(await (await fetch(`${base}/api/converge/status`)).json(), {
    state: 'idle',
  })
})

test('bulk approve and proposal listing', async () => {
  const res = await post('/api/proposals/approve-bulk', {
    min_confidence: 0.99,
  })
  assert.deepEqual(await res.json(), { approved: 0, errors: [] })
  const list = await (
    await fetch(`${base}/api/proposals?status=approved`)
  ).json()
  assert.equal(
    list.proposals.length,
    golden('reads').proposals.approved.proposals.length,
  )
  assert.equal(list.products.length, 11)
})

test('re-submitting a side panel capture replaces it (carts too)', async () => {
  const cart = (items) =>
    post('/api/grabs', {
      store: 'instacart',
      source: 'cart',
      order_date: '2026-09-28',
      capture_key: 'cap-1',
      items,
    })
  const a = { store_product_id: 'ic-cap-a', name: 'Cap A', price_each: 3 }
  const b = { store_product_id: 'ic-cap-b', name: 'Cap B', price_each: 4 }
  let res = await (await cart([a])).json()
  assert.equal(res.replaced, false)
  res = await (await cart([a, b])).json()
  assert.deepEqual([res.replaced, res.new, res.known], [true, 1, 1])
  const items = (await (await fetch(`${base}/api/pending`)).json()).items
  const capA = items.find((i) => i.store_product_id === 'ic-cap-a')
  assert.equal(capA.times_seen, 1) // one observation, not two
})

test('stock status: set, list, history, validation', async () => {
  let res = await post('/api/products/1/stock', { status: 'low' })
  assert.equal((await res.json()).status, 'low')
  await post('/api/products/2/stock', { status: 'out' })
  const map = await (await fetch(`${base}/api/stock`)).json()
  assert.deepEqual(
    [map[1].status, map[2].status, map[3].status],
    ['low', 'out', 'in_stock'],
  )
  res = await post('/api/products/1/stock', { status: 'gone' })
  assert.equal(res.status, 400)
  res = await post('/api/products/9999/stock', { status: 'low' })
  assert.deepEqual(await res.json(), { error: 'unknown product' })
})

test('preferred: one per product per store; Costco and Instacart share one slot', async () => {
  // product 6 (Bagels) has costco receipt cc-bagels and instacart ic-bagels on the Costco side
  let res = await post('/api/items/costco/cc-bagels/preferred', {
    preferred: true,
  })
  assert.equal(res.status, 200)
  await post('/api/items/instacart/ic-bagels/preferred', { preferred: true })
  const bagels = (
    await (await fetch(`${base}/api/compare`)).json()
  ).products.find((p) => p.name === 'Bagels')
  const flags = Object.fromEntries(
    bagels.stores.costco.versions.map((v) => [v.store_product_id, v.preferred]),
  )
  assert.deepEqual(flags, { 'ic-bagels': true, 'cc-bagels': false })
  res = await post('/api/items/walmart/nope/preferred', { preferred: true })
  assert.equal(res.status, 400)
})
