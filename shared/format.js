/** Display helpers shared by the web app and the side panel. */
export const money = (v) =>
  v === null || v === undefined || v === '' ? '' : `$${Number(v).toFixed(2)}`

/** YYYY-MM-DD -> MM/DD/YYYY */
export const usDate = (d) => {
  const [y, m, dd] = d.split('-')
  return `${m}/${dd}/${y}`
}

/** Local date as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString('en-CA')

export const plural = (n, one, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

export const STORE_NAMES = {
  walmart: 'Walmart',
  instacart: 'Instacart (Costco)',
  aldi: 'Aldi',
  costco: 'Costco',
}
