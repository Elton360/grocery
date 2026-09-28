/** shared/recommend.js: My List's best-store label and savings text (spec acceptance examples). */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  computeRecommendation,
  unitText,
  variantKey,
} from '../../shared/recommend.js'

// minimal /api/compare-shaped versions (ppu = price / net size, as the backend computes it)
const v = (id, price, net, extra = {}) => ({
  store_product_id: id,
  name: id,
  price,
  ppu: Number((price / net).toFixed(5)),
  unit: 'oz',
  comparable: true,
  pack_count: null,
  estimate: false,
  confirmed: null,
  ...extra,
})
const product = (category, stores, compareUnit = 'oz') => ({
  name: 'p',
  category,
  compare_unit: compareUnit,
  stores: {
    costco: { versions: stores.costco ?? [], not_carried: null },
    walmart: { versions: stores.walmart ?? [], not_carried: null },
    aldi: { versions: stores.aldi ?? [], not_carried: null },
  },
})

test('Greek Yogurt: "$0.131 / oz • 20% cheaper by volume"', () => {
  const p = product('dairy', {
    walmart: [v('wm-yogurt', 4.19, 32)], // $0.131 / oz
    aldi: [v('al-yogurt', 5.25, 32)], // $0.164 / oz
  })
  const rec = computeRecommendation(p)
  assert.equal(rec.store, 'walmart')
  assert.equal(rec.pct, 20)
  assert.equal(rec.reason, '$0.131 / oz • 20% cheaper by volume')
  assert.equal(rec.label, 'BEST VALUE') // same size at both stores
})

test('Fairlife: Costco 3-pack "Saves $1.95 per 3 pk" without being the best', () => {
  const pack = v('cc-fairlife-3', 11.37, 156, { unit: 'fl_oz', pack_count: 3 })
  const p = product(
    'dairy',
    {
      costco: [pack], // $0.073 / fl oz
      walmart: [v('wm-fairlife', 4.44, 52, { unit: 'fl_oz' })], // single
      aldi: [v('al-fairlife-2', 7.28, 104, { unit: 'fl_oz', pack_count: 2 })], // $0.070 / fl oz, cheapest
    },
    'fl_oz',
  )
  const rec = computeRecommendation(p)
  assert.equal(rec.store, 'aldi')
  assert.equal(rec.label, 'BULK CHOICE') // the winner is a multipack
  assert.equal(
    rec.savings.get(variantKey('costco', pack)),
    'Saves $1.95 per 3 pk',
  ) // 3 × 4.44 − 11.37
  assert.equal(unitText(pack.ppu, pack.unit, 'dairy'), '$0.073 / fl oz')
})

test('different pack sizes → BEST UNIT COST; produce shows $/lb', () => {
  const p = product('produce', {
    aldi: [v('al-straw', 2.29, 16)], // 1 lb
    costco: [v('cc-straw', 5.99, 32)], // 2 lb
  })
  const rec = computeRecommendation(p)
  assert.equal(rec.store, 'aldi')
  assert.equal(rec.label, 'BEST UNIT COST')
  assert.equal(rec.reason, '$2.29 / lb • 24% cheaper by weight')
})

test('one store, or units that differ, are labelled as such', () => {
  const one = computeRecommendation(
    product('pantry', { walmart: [v('wm-x', 3, 10)] }),
  )
  assert.deepEqual(
    [one.store, one.label, one.reason],
    ['walmart', 'ONLY AT', null],
  )
  const differ = computeRecommendation(
    product('bakery', {
      walmart: [v('wm-t', 4.28, 1, { unit: 'ea', comparable: false })],
      aldi: [v('al-t', 3.39, 8, { unit: 'ct' })],
    }),
  )
  assert.deepEqual([differ.store, differ.label], ['aldi', 'LOWEST PRICE'])
  assert.equal(computeRecommendation(product('other', {})), null)
})
