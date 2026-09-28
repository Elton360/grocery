/** Per-unit price math used by the compare API. */
import { normalize, parseSize, parseUnitPrice } from './units.js'

/**
 * Net quantity + per-unit price for one item at `price`.
 *
 * text: name and/or size text ("5.3 oz, 6-count", "1 lb", ...).
 * unitPriceText: the store's own unit price ("9.3¢/fl oz", "$3.72/lb"), used for weighed items and to
 * disambiguate "X oz, N count" packs. wasEach: pre-discount price, so discounted weighed items keep their weight.
 * weightLb: a known weight (e.g. from a receipt).
 */
export function measure(
  price,
  text,
  unitPriceText = '',
  wasEach = null,
  weightLb = null,
) {
  const size = parseSize(text)
  const storeUnit = unitPriceText ? parseUnitPrice(unitPriceText) : null
  let weightOz = weightLb ? weightLb * 16 : null
  if (
    !weightOz &&
    storeUnit &&
    storeUnit[1] === 'oz' &&
    unitPriceText.includes('/lb') &&
    !size.amount
  ) {
    // sold by weight: actual weight = pre-discount price / listed $/lb
    weightOz = (wasEach || price) / storeUnit[0]
  }

  let norm = normalize(size, price, { weightOz })
  if (
    !weightOz &&
    size.amount &&
    size.count &&
    size.count > 1 &&
    storeUnit &&
    (storeUnit[1] === 'oz' || storeUnit[1] === 'fl_oz')
  ) {
    // "X oz, N Count" is ambiguous (6 waffles in 11.6 oz vs 6 cups of 4 oz): pick whichever matches the store's unit price
    const base = wasEach || price
    const alt = normalize(size, price, { multipack: !size.multipackHint })
    if (
      Math.abs(base / alt.net_amount - storeUnit[0]) <
      Math.abs(base / norm.net_amount - storeUnit[0])
    ) {
      norm = alt
    }
  }
  norm.sold_by_weight = Boolean(weightOz)
  return norm
}

/** '(About 3.07 lb / package)' style weights on Instacart names. */
export function approxLb(text) {
  return parseSize(text).approxLb
}
