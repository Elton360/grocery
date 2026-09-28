import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { connect } from '../src/db.js'

const SEED = new URL('./fixtures/seed.sql', import.meta.url)
export const golden = (name) =>
  JSON.parse(
    fs.readFileSync(new URL(`./goldens/${name}.json`, import.meta.url)),
  )

/** A scratch database: schema + synthetic seed (fixtures/seed.sql); removed when the process exits. */
export function scratchDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grocery-test-'))
  const file = path.join(dir, 'grocery.db')
  const db = connect(file)
  db.exec(fs.readFileSync(SEED, 'utf8'))
  db.close()
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }))
  return file
}

const TODAY = new Date().toLocaleDateString('sv-SE')
const TS_KEYS = new Set([
  'captured_at',
  'status_changed_at',
  'created_at',
  'decided_at',
  'batch',
])

/** Same placeholders as goldens/capture.py: timestamps and today's date vary per run. */
export function scrub(v, key) {
  if (Array.isArray(v)) return v.map((x) => scrub(x))
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, scrub(x, k)]),
    )
  }
  if (typeof v === 'string')
    return TS_KEYS.has(key) && v ? '<ts>' : v.replaceAll(TODAY, '<today>')
  return v
}

/** Differences between two JSON values (numbers within a relative 1e-9), as "path: a != b" lines. */
export function diff(a, b, at = '$', out = []) {
  if (out.length > 20) return out
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)))
      out.push(`${at}: ${a} != ${b}`)
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      out.push(`${at}: length ${a.length} != ${b.length}`)
    for (let i = 0; i < Math.min(a.length, b.length); i++)
      diff(a[i], b[i], `${at}[${i}]`, out)
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a) || !(k in b))
        out.push(`${at}.${k}: ${k in a ? 'only in actual' : 'missing'}`)
      else diff(a[k], b[k], `${at}.${k}`, out)
    }
  } else if (a !== b) {
    out.push(
      `${at}: ${JSON.stringify(a)?.slice(0, 120)} != ${JSON.stringify(b)?.slice(0, 120)}`,
    )
  }
  return out
}

/** JSON round trip (drops undefined, like the API does) then diff against the golden. */
export function parity(actual, expected) {
  return diff(JSON.parse(JSON.stringify(actual)), expected)
}
