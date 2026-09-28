/**
 * Recommendation for a product on My List: which store version to buy, how to label it, and the savings
 * text shown on the variant tiles. Pure functions over one product from /api/compare.
 */
import { money } from './format.js'
import { STORES, headline } from './prices.js'

export const REC_LABELS = {
  best_value: 'BEST VALUE',
  best_unit_cost: 'BEST UNIT COST',
  bulk_choice: 'BULK CHOICE',
  only_store: 'ONLY AT',
  units_differ: 'LOWEST PRICE',
}

const BY_WEIGHT = new Set(['meat/seafood', 'produce'])

/** Unit price as shown on My List: $/lb for meat and produce, $/100 sheets, $/piece, else $/oz (3 decimals under $1). */
export function unitText(ppu, unit, category) {
  if (ppu === '' || ppu === null || ppu === undefined) return ''
  const v = Number(ppu)
  const amount = (x) => (x < 1 ? `$${Number(x.toFixed(3))}` : money(x))
  if (unit === 'sheet') return `${money(v * 100)} / 100 sheets`
  if (unit === 'ct') return `${amount(v)} / piece`
  if (unit === 'ea') return `${money(v)} each`
  if (unit === 'oz' && BY_WEIGHT.has(category)) return `${amount(v * 16)} / lb`
  return `${amount(v)} / ${unit === 'fl_oz' ? 'fl oz' : 'oz'}`
}

function cheaperBy(unit, category) {
  if (unit === 'ct') return 'per piece'
  if (unit === 'sheet') return 'per sheet'
  if (unit === 'oz' && BY_WEIGHT.has(category)) return 'by weight'
  return 'by volume'
}

const netSize = (v) => (Number(v.ppu) > 0 ? v.price / Number(v.ppu) : null)
const isMultipack = (v, product) =>
  v.pack_count > 1 && product.compare_unit !== 'ct'
const key = (store, v) => `${store}:${v.store_product_id}`

/**
 * Savings of a multipack versus buying singles at the cheapest other store that sells them:
 * packPrice × (singleUnitPrice / packUnitPrice) − packPrice (= n × singlePrice − packPrice for equal sizes).
 */
function multipackSavings(product, store, v, versions) {
  if (!isMultipack(v, product) || !v.comparable) return null
  const singles = versions.filter(
    ([s, o]) =>
      s !== store && o.comparable && !(o.pack_count > 1) && Number(o.ppu) > 0,
  )
  if (!singles.length) return null
  const [, single] = singles.reduce((a, b) =>
    Number(a[1].ppu) <= Number(b[1].ppu) ? a : b,
  )
  const saves = v.price * (Number(single.ppu) / Number(v.ppu)) - v.price
  return saves >= 0.01 ? `Saves ${money(saves)} per ${v.pack_count} pk` : null
}

/**
 * {store, version, kind, label, pct, reason, savings} or null when no store has a current price.
 *   kind     best_value | best_unit_cost | bulk_choice | only_store | units_differ
 *   pct      how much cheaper per unit the winner is than the next comparable store (rounded %)
 *   reason   meta text for the winning tile, e.g. "$0.131 / oz • 20% cheaper by volume"
 *   savings  Map of "store:id" → "Saves $1.95 per 3 pk" for multipacks cheaper than singles elsewhere
 */
export function computeRecommendation(product) {
  const heads = STORES.map((s) => [s, headline(product, s)]).filter(
    ([, v]) => v,
  )
  if (!heads.length) return null
  const all = STORES.flatMap((s) =>
    product.stores[s].versions.map((v) => [s, v]),
  )
  const savings = new Map()
  for (const [s, v] of all) {
    const text = multipackSavings(product, s, v, all)
    if (text) savings.set(key(s, v), text)
  }

  const comparable = heads.filter(([, v]) => v.comparable && v.ppu !== '')
  if (comparable.length < 2) {
    const [store, version] = heads.reduce((a, b) =>
      a[1].price <= b[1].price ? a : b,
    )
    const kind = heads.length === 1 ? 'only_store' : 'units_differ'
    return {
      store,
      version,
      kind,
      label: REC_LABELS[kind],
      pct: null,
      reason: null,
      savings,
    }
  }

  const byPpu = [...comparable].sort(
    (a, b) => Number(a[1].ppu) - Number(b[1].ppu),
  )
  const [store, version] = byPpu[0]
  const next = byPpu[1][1]
  const pct = Math.round((1 - Number(version.ppu) / Number(next.ppu)) * 100)
  const size = netSize(version)
  const sizesDiffer = byPpu
    .slice(1)
    .some(
      ([, o]) =>
        size && netSize(o) && Math.abs(netSize(o) - size) / size > 0.05,
    )
  const kind = isMultipack(version, product)
    ? 'bulk_choice'
    : sizesDiffer
      ? 'best_unit_cost'
      : 'best_value'
  const unit = unitText(version.ppu, version.unit, product.category)
  const reason =
    pct > 0
      ? `${unit} • ${pct}% cheaper ${cheaperBy(version.unit, product.category)}`
      : unit
  return { store, version, kind, label: REC_LABELS[kind], pct, reason, savings }
}

export const variantKey = key
