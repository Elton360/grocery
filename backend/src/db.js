/** SQLite connection (data/grocery.db) with the schema and additive migrations applied. */
import fs from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'

import { ROOT } from './paths.js'

export const DB_PATH =
  process.env.GROCERY_DB || path.join(ROOT, 'data', 'grocery.db')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS grabs (
  id INTEGER PRIMARY KEY,
  store TEXT NOT NULL,
  source TEXT NOT NULL,            -- cart | order | receipt | seed
  order_date TEXT,
  captured_at TEXT NOT NULL,
  page_url TEXT
);
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  grab_id INTEGER NOT NULL REFERENCES grabs(id),
  store TEXT NOT NULL,
  store_product_id TEXT NOT NULL,
  name TEXT, size_text TEXT, qty REAL, price_each REAL, line_total REAL,
  unit_price_text TEXT, url TEXT, image_url TEXT, notes TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS items (
  store TEXT NOT NULL,
  store_product_id TEXT NOT NULL,
  name TEXT, size_text TEXT, url TEXT, image_url TEXT,
  first_seen TEXT, last_seen TEXT, times_seen INTEGER DEFAULT 0,
  last_price REAL, last_source TEXT,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | ignored | converged
  status_changed_at TEXT,
  PRIMARY KEY (store, store_product_id)
);
CREATE INDEX IF NOT EXISTS obs_item ON observations(store, store_product_id);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY,
  batch TEXT,
  store TEXT NOT NULL,
  store_product_id TEXT NOT NULL,
  action TEXT NOT NULL,              -- link | new | pair | ignore | ask | version | not_carried | version_ask
  payload_json TEXT NOT NULL,
  confidence REAL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',   -- proposed | approved | rejected | superseded
  created_at TEXT,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS proposal_item ON proposals(store, store_product_id, status);
CREATE TABLE IF NOT EXISTS not_carried (
  product_id INTEGER NOT NULL REFERENCES products(id),
  store TEXT NOT NULL,
  note TEXT,
  checked_on TEXT,
  PRIMARY KEY (product_id, store)
);
`

const MIGRATIONS = [
  ['items', 'product_id', 'INTEGER REFERENCES products(id)'],
  ['grabs', 'order_key', 'TEXT'],
  ['items', 'weight_lb', 'REAL'], // known weight of a receipt line (weighed items)
  ['items', 'pair_id', 'TEXT'], // on Instacart items: the Costco receipt item number of the same product
  ['items', 'regular_price', 'REAL'], // non-promo price (Instacart original price)
  ['items', 'match_tier', 'TEXT'], // exact | equivalent | substitute (how it matches its product)
  ['items', 'note', 'TEXT'],
  ['items', 'exclude_markup', 'INTEGER DEFAULT 0'],
  ['items', 'preferred', 'INTEGER DEFAULT 0'], // shown first for its store
  ['grabs', 'price_mode', 'TEXT'], // in_store | pickup | online; pickup prices are not used for comparison
]

export function connect(file = DB_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = DELETE')
  db.exec(SCHEMA)
  for (const [table, col, decl] of MIGRATIONS) {
    const cols = db.pragma(`table_info(${table})`).map((r) => r.name)
    if (!cols.includes(col))
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`)
  }
  return db
}

/** Parameter placeholders for an IN (...) list. */
export const marks = (n) => Array(n).fill('?').join(',')
