/**
 * What can be imported from the active tab. `order` / `cart` name the grabber (public/grabbers/<name>.js)
 * behind "Import Ordered Items" / "Import Items from Cart"; null when the site has none (yet).
 */
const SITES = [
  {
    host: 'walmart.com',
    store: 'walmart',
    name: 'Walmart',
    order: 'walmart-order',
    cart: 'walmart-cart',
    hint: 'Orders: open one from Account → Purchase history. Cart: walmart.com/cart.',
  },
  {
    host: 'instacart.com',
    store: 'instacart',
    name: 'Costco (Instacart)',
    order: null,
    cart: 'instacart-cart',
    hint: 'Open the cart panel, then import.',
  },
  {
    host: 'aldi.us',
    store: 'aldi',
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

// What each grabber re-grabs, and the page it needs (checked against the active tab's URL).
const GRABBERS = {
  'walmart-order': {
    what: 'ordered items',
    page: (u) => u.pathname.startsWith('/orders/'),
    open: 'a Walmart order page',
  },
  'walmart-cart': {
    what: 'cart list',
    page: (u) => u.pathname.startsWith('/cart'),
    open: 'walmart.com/cart',
  },
  'instacart-cart': { what: 'cart list', page: () => true, open: 'Instacart' },
}
const STORE_LABEL = { walmart: 'Walmart', instacart: 'Instacart', aldi: 'Aldi' }

/**
 * Refresh = run the latest import's grabber again. Enabled only when the active tab is that store and the
 * right kind of page. Returns { enabled, label } where label is the button tooltip.
 */
export function refreshInfo(capture, url) {
  const g = capture && GRABBERS[capture.grabber]
  if (!g) {
    return {
      enabled: false,
      label:
        capture?.source === 'receipt'
          ? 'Receipts can’t be refreshed — paste them again'
          : 'Nothing to refresh',
    }
  }
  const what = capture.store === 'aldi' ? 'list' : g.what
  const from = STORE_LABEL[capture.store]
  let onPage = false
  try {
    onPage = siteFor(url)?.store === capture.store && g.page(new URL(url))
  } catch {
    onPage = false
  }
  return onPage
    ? { enabled: true, label: `Refresh ${what} from ${from}` }
    : {
        enabled: false,
        label: `Open ${capture.store === 'aldi' ? 'your Aldi list' : g.open} in this tab to refresh`,
      }
}
