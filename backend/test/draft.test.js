/** shared/draft.js: strategies, resolutions and auto-balancing (Draft page spec §4). */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  bestSingleStore,
  buildDraft,
  cheapestFullSingle,
  draftItems,
  resolutions,
  strategies,
} from '../../shared/draft.js'

const v = (id, price, extra = {}) => ({
  store_product_id: id,
  name: id,
  price,
  ppu: price,
  unit: 'ea',
  comparable: true,
  estimate: false,
  confirmed: null,
  preferred: false,
  ...extra,
})
let nextId = 1
const product = (name, { costco = [], walmart = [], aldi = [] }) => ({
  id: nextId++,
  name,
  category: 'pantry',
  compare_unit: 'ea',
  stores: {
    costco: { versions: costco, not_carried: null },
    walmart: { versions: walmart, not_carried: null },
    aldi: { versions: aldi, not_carried: null },
  },
})

// Aldi is cheapest overall but lacks milk and bananas; milk is preferred at Walmart.
const P = [
  product('Milk', {
    walmart: [v('wm-milk', 4.44, { preferred: true })],
    costco: [v('cc-milk', 4.1)],
  }),
  product('Bananas', {
    walmart: [v('wm-ban', 1.5)],
    costco: [v('cc-ban', 2.2)],
  }),
  product('Eggs', { aldi: [v('al-eggs', 2.79)], walmart: [v('wm-eggs', 3.2)] }),
  product('Bread', {
    aldi: [v('al-bread', 2.5)],
    walmart: [v('wm-bread', 1.9)],
  }), // >10% cheaper at Walmart
  product('Rice', { aldi: [v('al-rice', 3.0)], walmart: [v('wm-rice', 3.1)] }),
  product('Saffron', {}), // no price anywhere
  product('Coffee', { aldi: [v('al-coffee', 6)] }), // in stock: not drafted
]
const stock = Object.fromEntries(
  P.map((p) => [p.id, { status: p.name === 'Coffee' ? 'in_stock' : 'low' }]),
)
stock[P[0].id] = { status: 'out' }
const items = draftItems(P, stock, { [P[2].id]: 2 })

test('draftItems takes Low/Out rows with quantities (default 1)', () => {
  assert.deepEqual(
    items.map((i) => [i.product.name, i.status, i.qty]),
    [
      ['Milk', 'out', 1],
      ['Bananas', 'low', 1],
      ['Eggs', 'low', 2],
      ['Bread', 'low', 1],
      ['Rice', 'low', 1],
      ['Saffron', 'low', 1],
    ],
  )
})

test('strategies: cheapest, preferences (baseline), one store, up to 2 stores', () => {
  const s = strategies(items, 'aldi')
  // cheapest: milk costco 4.10, bananas walmart 1.50, eggs aldi 5.58, bread walmart 1.90, rice aldi 3.00
  assert.equal(s.cheapest.total, 16.08)
  assert.deepEqual(s.cheapest.stores, ['costco', 'walmart', 'aldi'])
  assert.deepEqual(s.cheapest.noPrice, [P[5].id])
  // preferences: milk at walmart (preferred) instead of costco
  assert.equal(s.preferences.total, 16.42)
  assert.equal(
    s.preferences.lines.find((l) => l.name === 'Milk').reason,
    'preferred',
  )
  // one store at Aldi: eggs, bread, rice; milk + bananas missing
  assert.equal(s.one.total, 11.08)
  assert.deepEqual(s.one.missing, [P[0].id, P[1].id])
  // up to 2 stores: walmart + aldi covers everything priced
  assert.equal(s.two.stores.length, 2)
  assert.equal(s.two.missing.length, 0)
  assert.equal(bestSingleStore(items), 'walmart') // the only store carrying all 5 priced items
})

test('resolutions around Aldi: add Walmart auto-balanced, best of all, leave off', () => {
  const r = resolutions(items, 'aldi')
  assert.equal(r.addStore.store, 'walmart')
  assert.equal(r.addStore.covers, 2)
  const bal = r.addStore.result
  const by = Object.fromEntries(bal.lines.map((l) => [l.name, l]))
  assert.deepEqual([by.Milk.store, by.Milk.reason], ['walmart', 'gap']) // missing at Aldi
  assert.equal(by.Milk.preferred, true)
  assert.deepEqual(
    [by.Bread.store, by.Bread.reason, by.Bread.moved],
    ['walmart', 'cheapest', true],
  )
  assert.deepEqual([by.Rice.store, by.Rice.reason], ['aldi', 'anchor']) // Aldi is already the cheaper one
  assert.deepEqual([by.Eggs.store], ['aldi'])
  assert.deepEqual(bal.stores, ['aldi', 'walmart'])
  assert.equal(
    r.addStore.delta,
    Math.round((bal.total - r.base.total) * 100) / 100,
  )
  assert.equal(r.leaveOff.delta, 0)
  assert.equal(r.bestOfAll.result.missing.length, 0)
})

test('savings card compares with the cheapest single store covering everything', () => {
  const full = cheapestFullSingle(items)
  assert.equal(full.store, 'walmart')
  assert.equal(full.result.total, 4.44 + 1.5 + 6.4 + 1.9 + 3.1)
})

test('anchor keeps items unless preferred elsewhere or ≥10% cheaper', () => {
  const only = [items[4]] // Rice: aldi 3.00 vs walmart 3.10 → stays at the anchor
  const r = buildDraft({
    items: only,
    allowedStores: ['walmart', 'aldi'],
    honorPreferences: true,
    anchorStore: 'walmart',
  })
  assert.equal(r.lines[0].store, 'walmart') // aldi is only 3% cheaper
})
