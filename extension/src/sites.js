/**
 * What can be imported from the active tab. `order` / `cart` name the grabber (public/grabbers/<name>.js)
 * behind "Import Ordered Items" / "Import Items from Cart"; null when the site has none (yet).
 */
const SITES = [
  {
    host: 'walmart.com',
    name: 'Walmart',
    order: 'walmart-order',
    cart: 'walmart-cart',
    hint: 'Orders: open one from Account → Purchase history. Cart: walmart.com/cart.',
  },
  {
    host: 'instacart.com',
    name: 'Costco (Instacart)',
    order: null,
    cart: 'instacart-cart',
    hint: 'Open the cart panel, then import.',
  },
  {
    host: 'aldi.us',
    name: 'Aldi',
    order: null,
    cart: 'instacart-cart',
    hint: 'Use In-Store mode and open your list, then import.',
  },
]

export function siteFor(url) {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  return (
    SITES.find((s) => host === s.host || host.endsWith(`.${s.host}`)) ?? null
  )
}
