/** Small helpers shared by the backend modules (ports of Python built-ins the logic relied on). */

/** A bad request: the API answers 400 with the message. */
export class ValueError extends Error {}

const pad = (n) => String(n).padStart(2, '0')

/** Local date, YYYY-MM-DD. */
export function today(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local timestamp to the second, YYYY-MM-DDTHH:MM:SS. */
export function now(d = new Date()) {
  return `${today(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Batch id from the current time, YYYYMMDD-HHMMSS. */
export function batchId(d = new Date()) {
  return now(d).replace(/[-:]/g, '').replace('T', '-')
}

/**
 * Round like Python's round(x, n): to the nearest decimal, ties to even, decided on the exact binary value.
 * (toFixed rounds ties up, which differs from Python on exact halves like 0.125.)
 */
export function pyRound(x, n = 0) {
  if (!Number.isFinite(x)) return x
  const [int, frac = ''] = Math.abs(x)
    .toFixed(Math.min(100, n + 60))
    .split('.')
  const digits = int + frac.slice(0, n)
  const rest = frac.slice(n)
  const up =
    rest[0] > '5' ||
    (rest[0] === '5' &&
      (/[1-9]/.test(rest.slice(1)) || Number(digits.at(-1)) % 2 === 1))
  const v = (BigInt(digits) + (up ? 1n : 0n)).toString().padStart(n + 1, '0')
  const out = Number(n ? `${v.slice(0, -n)}.${v.slice(-n)}` : v)
  return x < 0 && out !== 0 ? -out : out
}

export function median(values) {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Python's float(): numbers, bools and numeric strings; anything else throws. */
export function toFloat(v) {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return Number(v)
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))
    return Number(v)
  throw new TypeError(`not a number: ${v}`)
}

/** Python's repr() for the scalar values that appear in error messages. */
export function repr(v) {
  if (v === null || v === undefined) return 'None'
  if (typeof v === 'string') return `'${v}'`
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  return String(v)
}

/** Tuple-style comparator from a key function returning arrays (booleans and numbers or strings). */
export function byKey(key) {
  return (a, b) => {
    const ka = key(a)
    const kb = key(b)
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1
      if (ka[i] > kb[i]) return 1
    }
    return 0
  }
}
