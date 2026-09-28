/** Grab actions offered for the active tab's site. `grabber` = public/grabbers/<name>.js */
const SITES = [
  {
    host: 'walmart.com',
    name: 'Walmart',
    actions: [
      {
        label: 'Grab order',
        grabber: 'walmart-order',
        hint: 'On an order detail page (Account → Purchase history)',
      },
      {
        label: 'Grab cart',
        grabber: 'walmart-cart',
        hint: 'On walmart.com/cart',
      },
    ],
  },
  {
    host: 'instacart.com',
    name: 'Instacart (Costco)',
    actions: [
      {
        label: 'Grab cart',
        grabber: 'instacart-cart',
        hint: 'Open the cart panel first',
      },
    ],
  },
  {
    host: 'aldi.us',
    name: 'Aldi',
    actions: [
      {
        label: 'Grab list',
        grabber: 'instacart-cart',
        hint: 'In-Store mode, with your list open (prices are shelf prices only in In-Store mode)',
      },
    ],
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
