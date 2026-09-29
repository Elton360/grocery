/** Display metadata for stores and categories on My List (names, dot colors, icons). Change them here. */
import {
  CupSoda,
  Cookie,
  Croissant,
  Fish,
  Leaf,
  Milk,
  Package,
  Pill,
  ShoppingBasket,
  Snowflake,
  SprayCan,
} from 'lucide-react'

export const STORE_META = {
  walmart: { name: 'Walmart', dot: '#1F4A33' },
  costco: { name: 'Costco', dot: '#1E2A78' },
  aldi: { name: 'Aldi', dot: '#1F4A33' },
}

export const CATEGORY_META = {
  produce: { name: 'Produce', icon: Leaf },
  dairy: { name: 'Dairy & Eggs', icon: Milk },
  'meat/seafood': { name: 'Meat & Seafood', icon: Fish },
  bakery: { name: 'Bakery', icon: Croissant },
  snacks: { name: 'Snacks', icon: Cookie },
  pantry: { name: 'Pantry', icon: Package },
  frozen: { name: 'Frozen', icon: Snowflake },
  household: { name: 'Household', icon: SprayCan },
  beverages: { name: 'Beverages', icon: CupSoda },
  'personal care': { name: 'Personal Care', icon: Pill },
  other: { name: 'Other', icon: ShoppingBasket },
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase())

/** Known categories get their name and icon; new ones (created by converge) are title-cased. */
export const categoryMeta = (id) =>
  CATEGORY_META[id] ?? {
    name: id ? titleCase(id) : 'Uncategorized',
    icon: ShoppingBasket,
  }
