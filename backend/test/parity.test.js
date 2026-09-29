/** Node port vs goldens captured from the legacy Python backend (test/goldens/capture.py). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'

import { connect } from '../src/db.js'
import * as compare from '../src/lib/compare.js'
import * as converge from '../src/lib/converge.js'
import * as grabs from '../src/lib/grabs.js'
import * as normalize from '../src/lib/normalize.js'
import { ValueError } from '../src/lib/util.js'

import { golden, parity, scratchDb, scrub } from './helpers.js'

const check = (actual, expected, label) => {
  const d = parity(scrub(JSON.parse(JSON.stringify(actual))), expected)
  assert.deepEqual(d, [], `${label} differs:\n${d.join('\n')}`)
}

test('read APIs match the Python goldens', () => {
  const db = connect(scratchDb())
  const g = golden('reads')
  check(compare.build(db), g.compare, 'compare')
  for (const s of ['pending', 'ignored', 'converged'])
    check(grabs.listItems(db, s), g.items[s], `items ${s}`)
  for (const s of ['proposed', 'approved', 'rejected', 'superseded']) {
    check(converge.listProposals(db, s), g.proposals[s], `proposals ${s}`)
  }
  check(converge.exportBatch(db), g.converge_export, 'converge export')
  for (const s of Object.keys(normalize.TARGETS)) {
    check(
      normalize.exportBatch(db, s),
      g.normalize_export[s],
      `normalize export ${s}`,
    )
  }
  db.close()
})

function dump(db) {
  const out = {}
  const tables = [
    ['grabs', 'id'],
    ['observations', 'id'],
    ['items', 'store, store_product_id'],
    ['products', 'id'],
    ['not_carried', 'product_id, store'],
    ['proposals', 'id'],
  ]
  for (const [t, order] of tables) {
    out[t] = db
      .prepare(`SELECT * FROM ${t} ORDER BY ${order}`)
      .all()
      // eslint-disable-next-line no-unused-vars
      .map(({ stock_status, stock_changed_at, ...r }) =>
        // stock columns were added after the Python backend (no golden for them)
        'payload_json' in r
          ? { ...r, payload_json: JSON.parse(r.payload_json) }
          : r,
      )
  }
  return out
}

const OPS = {
  check: (db, o) => grabs.statusOf(db, o.store, o.ids),
  grab: (db, o) => grabs.saveGrab(db, o.payload),
  ignore: (db, o) => grabs.ignoreItems(db, o.store, o.items),
  list: (db, o) => grabs.listItems(db, o.status),
  set_status: (db, o) => grabs.setStatus(db, o.store, o.id, o.action),
  converge_export: (db) => converge.exportBatch(db),
  converge_apply: (db, o) => converge.apply(db, o.data),
  proposals: (db, o) => converge.listProposals(db, o.status),
  approve: (db, o) => converge.approve(db, o.id, o.edits),
  reject: (db, o) => converge.reject(db, o.id),
  approve_bulk: (db, o) => converge.approveBulk(db, o.min_confidence),
  normalize_export: (db, o) => normalize.exportBatch(db, o.store, o.limit),
  normalize_apply: (db, o) => normalize.apply(db, o.data),
  compare: (db) => compare.build(db),
  dump,
}

// observations.raw_json is JSON text: Python and Node space it differently
const parseRaw = (d) => {
  for (const o of d.observations)
    if (o.raw_json) o.raw_json = JSON.parse(o.raw_json)
  return d
}

test('scenario (grabs, dedupe, ignore, converge, normalize, approvals) matches Python', () => {
  const file = scratchDb()
  const ops = JSON.parse(
    fs.readFileSync(new URL('./fixtures/scenario.json', import.meta.url)),
  )
  const expected = golden('scenario')
  ops.forEach((op, i) => {
    const db = connect(file)
    let got
    try {
      got = { op: op.op, result: db.transaction(() => OPS[op.op](db, op))() }
    } catch (e) {
      if (!(e instanceof ValueError)) throw e
      got = { op: op.op, error: e.message }
    } finally {
      db.close()
    }
    let want = expected[i]
    if (op.op === 'dump') {
      got.result = parseRaw(got.result)
      want = { ...want, result: parseRaw(structuredClone(want.result)) }
    }
    check(got, want, `op #${i} ${op.op}`)
  })
})
