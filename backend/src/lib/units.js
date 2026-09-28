/** Package size parsing and per-unit normalization. */
import { pyRound } from './util.js'

const NUM = String.raw`(\d+(?:\.\d+)?)`
const re = (src, flags = 'i') => new RegExp(src, flags)

/**
 * @typedef {object} Size
 * @property {number|null} amount   per-item amount in `unit`
 * @property {string|null} unit     'oz' (weight) | 'fl_oz'
 * @property {number|null} count
 * @property {number|null} sheets
 * @property {[number, number]|null} lbRange
 * @property {number|null} approxLb
 * @property {boolean} multipackHint  "X oz, N-count" style
 */

/** @returns {Size} */
export function parseSize(text) {
  const t = text.replaceAll('&amp;', '&')
  const s = {
    amount: null,
    unit: null,
    count: null,
    sheets: null,
    lbRange: null,
    approxLb: null,
    multipackHint: false,
  }
  let m

  if ((m = t.match(re(String.raw`about\s+${NUM}\s*lb`))))
    s.approxLb = Number(m[1])
  if ((m = t.match(re(String.raw`${NUM}\s*-\s*${NUM}\s*lb`))))
    s.lbRange = [Number(m[1]), Number(m[2])]

  // "Per 4 Oz Serving" is nutrition info, not package size
  const ozRe = String.raw`${NUM}\s*(?:oz|ounces?)\b(?!\s*serving)`
  if (/half gallon/i.test(t)) {
    s.amount = 64
    s.unit = 'fl_oz'
  } else if (
    (m = t.match(re(String.raw`${NUM}\s*(?:fl\.?\s*oz|fluid ounces?)`)))
  ) {
    s.amount = Number(m[1])
    s.unit = 'fl_oz'
  } else if ((m = t.match(re(ozRe)))) {
    s.amount = Number(m[1])
    s.unit = 'oz'
  } else if (
    !(s.lbRange || s.approxLb) &&
    (m = t.match(re(String.raw`${NUM}\s*(?:lbs?|pounds?)\b`)))
  ) {
    s.amount = Number(m[1]) * 16
    s.unit = 'oz'
  }

  // (?<![\d-]) skips grade ranges like shrimp "31-40-count"
  const countPatterns = [
    [String.raw`(?<![\d.-])(\d+)\s*[- ]?\s*(?:count|ct)\b`, 1],
    [
      String.raw`(?<![\d.-])(\d+)\s*(?:individually wrapped\s+)?(?:rolls|tablets|gel stamps|pk)\b`,
      1,
    ],
    [String.raw`(?<![\d.-])(\d+)\s*dz\b`, 12],
  ]
  for (const [pat, mult] of countPatterns) {
    if ((m = t.match(re(pat)))) {
      s.count = parseInt(m[1], 10) * mult
      break
    }
  }

  if ((m = t.match(/(\d+)\s*sheets/i)) && s.count)
    s.sheets = parseInt(m[1], 10) * s.count

  s.multipackHint =
    /(?:oz|ounces?|gallon)\s*,\s*\d+\s*[- ]?\s*count|count\b.*\boz bars/i.test(
      t,
    )
  return s
}

/** Walmart-style '9.3¢/fl oz', '$3.72/lb', '$5.00/ea' -> [dollars per base unit, base unit]. */
export function parseUnitPrice(text) {
  const m = text.match(
    new RegExp(String.raw`(\$)?${NUM}(¢)?/(fl oz|oz|lb|ea|ct|count)`),
  )
  if (!m) return null
  const v = Number(m[2]) / (m[3] ? 100 : 1)
  const unit = m[4]
  if (unit === 'lb') return [v / 16, 'oz']
  if (unit === 'fl oz') return [v, 'fl_oz']
  if (unit === 'oz') return [v, 'oz']
  return [v, 'ea']
}

/** Pick net quantity + per-unit price. `price` is the price of one purchased item. */
export function normalize(
  size,
  price,
  { multipack = null, weightOz = null } = {},
) {
  if (multipack === null) multipack = size.multipackHint
  const out = {
    pack_count: size.count || '',
    net_amount: '',
    net_unit: '',
    price_per_unit: '',
    price_per_count: '',
    unit_label: '',
  }

  if (size.count && size.count > 1)
    out.price_per_count = pyRound(price / size.count, 4)

  if (size.sheets) {
    return Object.assign(out, {
      net_amount: size.sheets,
      net_unit: 'sheet',
      price_per_unit: pyRound(price / size.sheets, 6),
      unit_label: 'sheet',
    })
  }

  let net = null
  let unit = size.unit
  if (weightOz) {
    net = weightOz
    unit = 'oz'
  } else if (size.amount) {
    net = size.amount * (multipack && size.count ? size.count : 1)
  } else if (size.approxLb) {
    net = size.approxLb * 16
    unit = 'oz'
  }

  if (net) {
    Object.assign(out, {
      net_amount: pyRound(net, 3),
      net_unit: unit,
      price_per_unit: pyRound(price / net, 5),
      unit_label: unit,
    })
  } else if (size.count) {
    Object.assign(out, {
      net_amount: size.count,
      net_unit: 'ct',
      price_per_unit: pyRound(price / size.count, 4),
      unit_label: 'ct',
    })
  } else {
    Object.assign(out, {
      net_amount: 1,
      net_unit: 'ea',
      price_per_unit: pyRound(price, 4),
      unit_label: 'ea',
    })
  }
  return out
}
