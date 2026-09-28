/** Matching rules given to the AI agent in converge and normalize exports. */
export const RULES = [
  'Hard requirement: milk must be ultra-filtered (lactose-free 2% like Kirkland/fairlife). Never link other milk to that product.',
  'Hard requirement: eggs must be at least cage-free. Never link conventional eggs to the Eggs product.',
  'Minor differences (brand vs store brand, organic vs not, pack size) are fine: link as another version (tier equivalent).',
  'Different product types stay separate (guacamole is not avocado mash; marinara is not alfredo).',
  'Compare per count when every version of a product has a pack count; set size_text so price math works (e.g. "5.3 oz, 6-count", "1 lb", "110 Sheets, 12 Rolls").',
  'Costco receipt lines (store costco, numeric item numbers) and Instacart listings (store instacart) are different ids for the same Costco product: propose action "pair" when a pending one matches an unpaired one on the other side.',
  'Anything uncertain, below 0.6 confidence, or touching a hard requirement: action "ask" with a reason and up to 3 candidate product ids.',
  'Non-grocery one-offs (decor, clothing, gifts): action "ignore".',
]
