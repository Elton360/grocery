/** Builds the compare-page payload from SQLite: products → per-store versions with per-unit prices. */
import { approxLb, measure } from './metrics.js'
import { byKey, median, pyRound } from './util.js'

export const STORES = ['costco', 'walmart', 'aldi']
const DEFAULT_MARKUP = 1.1

const key = (store, id) => `${store}\u0000${id}`

function latestObservations(db) {
  const rows = db
    .prepare(
      `SELECT o.store, o.store_product_id, o.price_each, o.unit_price_text, o.notes, o.raw_json, g.order_date, g.id AS grab_id
       FROM observations o JOIN grabs g ON g.id = o.grab_id
       WHERE COALESCE(g.price_mode, '') != 'pickup'   -- Aldi pickup prices run ~10-13% above in-store
       ORDER BY g.order_date, g.id, o.id`,
    )
    .all()
  const latest = new Map()
  for (const r of rows) latest.set(key(r.store, r.store_product_id), r) // later rows win
  return latest
}

export function wasPrice(notes) {
  const m = (notes || '').match(/was \$(\d+\.\d\d)/)
  return m ? Number(m[1]) : null
}

function regularPrice(item, obs) {
  if (item.regular_price !== null) return item.regular_price
  if (obs?.raw_json) {
    const orig = JSON.parse(obs.raw_json)?.original_price
    if (orig) return orig
  }
  return obs ? obs.price_each : item.last_price
}

/** Median Instacart/Costco price ratio over paired items; weighed pairs compare per lb and need the receipt weight. */
function instacartMarkup(items, byId, latest) {
  const ratios = []
  for (const it of items) {
    if (it.store !== 'instacart' || !it.pair_id) continue
    const c = byId.get(key('costco', it.pair_id))
    const conf = latest.get(key('costco', it.pair_id))
    if (!c || !conf || c.exclude_markup) continue
    const reg = regularPrice(
      it,
      latest.get(key('instacart', it.store_product_id)),
    )
    const approx = approxLb(it.name || '')
    if (approx) {
      if (c.weight_lb)
        ratios.push(reg / approx / (conf.price_each / c.weight_lb))
    } else {
      ratios.push(reg / conf.price_each)
    }
  }
  return ratios.length ? median(ratios) : DEFAULT_MARKUP
}

function version(it, price, m, extra = {}) {
  return {
    store_product_id: it.store_product_id,
    name: it.name,
    url: it.url,
    image_url: it.image_url,
    price: pyRound(price, 2),
    ppu: m.price_per_unit,
    unit: m.unit_label,
    per_count: m.price_per_count || null,
    pack_count: m.pack_count || null,
    sold_by_weight: m.sold_by_weight,
    tier: it.match_tier,
    note: it.note,
    times_seen: it.times_seen,
    last_seen: it.last_seen,
    preferred: Boolean(it.preferred),
    estimate: false,
    confirmed: null,
    ...extra,
  }
}

function costcoVersions(productItems, byId, latest, markup) {
  const out = []
  const paired = new Set()
  for (const it of productItems) {
    if (it.store !== 'instacart') continue
    const reg = regularPrice(
      it,
      latest.get(key('instacart', it.store_product_id)),
    )
    if (reg === null || reg === undefined) continue
    const c = it.pair_id ? byId.get(key('costco', it.pair_id)) : null
    const conf = it.pair_id ? latest.get(key('costco', it.pair_id)) : null
    if (it.pair_id) paired.add(it.pair_id)
    const text = it.size_text || it.name || ''
    const approx = approxLb(it.name || '')
    let price
    let m
    if (approx) {
      const estPerOz = reg / (approx * 16) / markup
      const weightOz = c?.weight_lb
        ? c.weight_lb * 16
        : conf
          ? conf.price_each / estPerOz
          : approx * 16
      price = estPerOz * weightOz
      m = measure(price, text, '', null, weightOz / 16)
    } else {
      price = reg / markup
      m = measure(price, text)
    }
    out.push(
      version(it, price, m, {
        estimate: true,
        instacart_price: reg,
        confirmed: conf
          ? { price: conf.price_each, on: conf.order_date }
          : null,
      }),
    )
  }
  for (const it of productItems) {
    if (it.store !== 'costco' || paired.has(it.store_product_id)) continue
    const conf = latest.get(key('costco', it.store_product_id))
    if (!conf) continue
    const m = measure(
      conf.price_each,
      it.size_text || it.name || '',
      '',
      null,
      it.weight_lb,
    )
    out.push(
      version(it, conf.price_each, m, {
        confirmed: { price: conf.price_each, on: conf.order_date },
        instacart_price: null,
      }),
    )
  }
  return out
}

function shelfVersions(store, productItems, latest) {
  const out = []
  for (const it of productItems) {
    if (it.store !== store) continue
    const obs = latest.get(key(store, it.store_product_id))
    const price =
      obs && obs.price_each !== null ? obs.price_each : it.last_price
    if (price === null || price === undefined) continue
    const m = measure(
      price,
      it.size_text || it.name || '',
      obs?.unit_price_text || '',
      wasPrice(obs?.notes),
    )
    out.push(version(it, price, m))
  }
  return out
}

/** Per count when every version has a pack count (sheets win for paper goods), else the most common unit. */
function applyCompareUnit(versions) {
  if (!versions.length) return null
  let unit
  if (
    versions.every((v) => v.per_count) &&
    !versions.some((v) => v.unit === 'sheet')
  ) {
    for (const v of versions) {
      if (v.unit !== 'ct') {
        v.alt_ppu = v.ppu
        v.alt_unit = v.unit
      }
      v.ppu = v.per_count
      v.unit = 'ct'
    }
    unit = 'ct'
  } else {
    const counts = new Map() // insertion order = first appearance, which wins ties
    for (const v of versions) counts.set(v.unit, (counts.get(v.unit) || 0) + 1)
    unit = [...counts].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]
    for (const v of versions) {
      if (v.unit !== 'ct' && v.per_count) {
        v.alt_ppu = v.per_count
        v.alt_unit = 'ct'
      }
    }
  }
  for (const v of versions) v.comparable = v.unit === unit
  return unit
}

export function build(db) {
  const items = db
    .prepare(
      `SELECT i.*, p.name AS product_name, p.category FROM items i JOIN products p ON p.id = i.product_id
       WHERE i.status = 'converged' ORDER BY i.rowid`,
    )
    .all()
  const byId = new Map(items.map((i) => [key(i.store, i.store_product_id), i]))
  const latest = latestObservations(db)
  const markup = instacartMarkup(items, byId, latest)
  const notCarried = new Map(
    db
      .prepare('SELECT * FROM not_carried')
      .all()
      .map((r) => [
        `${r.product_id}:${r.store}`,
        { note: r.note, checked_on: r.checked_on },
      ]),
  )

  const byProduct = new Map()
  for (const it of items) {
    if (!byProduct.has(it.product_id)) byProduct.set(it.product_id, [])
    byProduct.get(it.product_id).push(it)
  }
  const products = []
  for (const [pid, its] of byProduct) {
    const stores = {
      costco: costcoVersions(its, byId, latest, markup),
      walmart: shelfVersions('walmart', its, latest),
      aldi: shelfVersions('aldi', its, latest),
    }
    const unit = applyCompareUnit(STORES.flatMap((s) => stores[s]))
    for (const s of STORES) {
      stores[s].sort(
        byKey((v) => [!v.preferred, !v.comparable, v.ppu !== '' ? v.ppu : 1e9]),
      )
    }
    products.push({
      id: pid,
      name: its[0].product_name,
      category: its[0].category,
      compare_unit: unit,
      stores: Object.fromEntries(
        STORES.map((s) => [
          s,
          {
            versions: stores[s],
            not_carried: notCarried.get(`${pid}:${s}`) ?? null,
          },
        ]),
      ),
    })
  }
  products.sort(byKey((p) => [p.category || '', p.name]))
  return { markup: pyRound(markup, 4), products }
}
