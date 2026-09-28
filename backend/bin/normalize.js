#!/usr/bin/env node
/**
 * Normalize CLI (used by the /normalize skill), run from the repo root:
 *
 *   node backend/bin/normalize.js export --store <costco|aldi|walmart> [--limit N]  -> data/normalize/batch-<store>-<id>.json
 *   node backend/bin/normalize.js apply <proposals.json>                             -> validates + stores proposals for review
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { connect } from '../src/db.js'
import * as normalize from '../src/lib/normalize.js'
import { DATA, ROOT } from '../src/paths.js'

const OUT = path.join(DATA, 'normalize')
const USAGE = `usage:
  node backend/bin/normalize.js export --store <${Object.keys(normalize.TARGETS).sort().join('|')}> [--limit N]
  node backend/bin/normalize.js apply <proposals.json>`

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { store: { type: 'string' }, limit: { type: 'string' } },
  })
  const [cmd, file] = positionals
  const db = connect()
  if (cmd === 'export' && values.store in normalize.TARGETS) {
    const limit = values.limit ? parseInt(values.limit, 10) : null
    const data = db.transaction(() =>
      normalize.exportBatch(db, values.store, limit),
    )()
    fs.mkdirSync(OUT, { recursive: true })
    const out = path.join(OUT, `batch-${values.store}-${data.batch}.json`)
    fs.writeFileSync(out, JSON.stringify(data, null, 1))
    console.log(
      JSON.stringify({
        export: path.relative(ROOT, out),
        batch: data.batch,
        store: values.store,
        products: data.products.length,
        queue_remaining: data.queue_remaining,
      }),
    )
    return 0
  }
  if (cmd === 'apply' && file) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const report = db.transaction(() => normalize.apply(db, data))()
    console.log(JSON.stringify(report, null, 1))
    return report.invalid.length && !report.stored ? 1 : 0
  }
  console.log(USAGE)
  return 2
}

process.exitCode = main(process.argv.slice(2))
