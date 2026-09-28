/** Compare-page price rules: Costco estimates vs store-confirmed prices, headline version, winner, unit display. */
import { money } from '../../../shared/format.js'

export const STORES = ['costco', 'walmart', 'aldi']
export const CONFIRMED_MAX_DAYS = 30

const ageDays = (d) => (Date.now() - Date.parse(`${d}T00:00:00`)) / 864e5

/**
 * Costco headline is the Instacart-derived estimate; a store-confirmed price under 30 days old clears the
 * est. badge only when within 5% and $5 of it. Older confirmed prices are ignored entirely.
 */
export function priceState(v) {
  const c = v.confirmed
  const fresh = Boolean(c && ageDays(c.on) <= CONFIRMED_MAX_DAYS)
  if (!v.estimate) {
    if (c && !fresh) return { stale: true }
    return { est: false, confirmed: fresh ? { price: null, on: c.on } : null }
  }
  const close =
    fresh && Math.abs(c.price - v.price) <= Math.min(5, 0.05 * v.price)
  return { est: !close, confirmed: fresh ? c : null }
}

/** The version shown for a store: the first (best) one with a current price. */
export const headline = (product, store) =>
  product.stores[store].versions.find((v) => !priceState(v).stale) ?? null

/** Cheapest store per compare unit, when at least two stores are comparable. */
export function winnerOf(product) {
  const heads = STORES.map((s) => [s, headline(product, s)]).filter(
    ([, v]) => v && v.comparable && v.ppu !== '',
  )
  if (heads.length < 2) return null
  return heads.reduce((a, b) =>
    Number(a[1].ppu) <= Number(b[1].ppu) ? a : b,
  )[0]
}

/** Display unit: meat/seafood & produce by weight -> $/lb; paper -> per 100 sheets; small $/oz -> ¢/oz */
export function fmtUnit(ppu, unit, category) {
  if (ppu === '' || ppu === null || ppu === undefined) return ''
  const v = Number(ppu)
  if (unit === 'sheet') return `${money(v * 100)} / 100 sheets`
  if (
    unit === 'oz' &&
    (category === 'meat/seafood' || category === 'produce')
  ) {
    return `${money(v * 16)} / lb`
  }
  if (unit === 'oz' || unit === 'fl_oz') {
    const u = unit === 'oz' ? 'oz' : 'fl oz'
    return v < 1 ? `${(v * 100).toFixed(1)}¢ / ${u}` : `${money(v)} / ${u}`
  }
  if (unit === 'ct') return `${money(v)} per piece`
  return `${money(v)} each`
}
