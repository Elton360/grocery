/** External links used by the side panel. Keep every URL here so they don't spread through components. */
import { BACKEND } from './config.js'

/** Store sites offered on the main view (opened in a new tab when clicked). */
export const STORE_LINKS = [
  { store: 'walmart', label: 'Walmart', url: 'https://www.walmart.com/' },
  {
    store: 'costco',
    label: 'Costco (Instacart)',
    url: 'https://www.instacart.com/store/costco/storefront',
  },
  {
    store: 'aldi',
    label: 'Aldi',
    url: 'https://www.aldi.us/store/aldi/storefront',
  },
]

/** Pages of the web app. */
export const APP_LINKS = {
  myList: `${BACKEND}/`,
  review: `${BACKEND}/review`,
}
