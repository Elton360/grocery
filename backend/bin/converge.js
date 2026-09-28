#!/usr/bin/env node
/**
 * Converge CLI (used by the /converge skill and by hand), run from the repo root:
 *
 *   node backend/bin/converge.js export              -> writes data/converge/batch-<id>.json, prints its path and counts
 *   node backend/bin/converge.js apply <file.json>   -> validates proposals and stores them for review (nothing is linked yet)
 */
import fs from 'node:fs'

import { connect } from '../src/db.js'
import * as converge from '../src/lib/converge.js'

const USAGE = `usage:
  node backend/bin/converge.js export
  node backend/bin/converge.js apply <proposals.json>`

function main([cmd, file, ...rest]) {
  if (cmd === 'export' && !file) {
    const db = connect()
    const { file: out, data } = db.transaction(() => converge.writeExport(db))()
    console.log(
      JSON.stringify({
        export: out,
        batch: data.batch,
        pending: data.pending.length,
        products: data.products.length,
      }),
    )
    return 0
  }
  if (cmd === 'apply' && file && !rest.length) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const db = connect()
    const report = db.transaction(() => converge.apply(db, data))()
    console.log(JSON.stringify(report, null, 1))
    return report.invalid.length && !report.stored ? 1 : 0
  }
  console.log(USAGE)
  return 2
}

process.exitCode = main(process.argv.slice(2))
