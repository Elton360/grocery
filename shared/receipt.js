/** Costco receipt lines pasted by the user, e.g. `E 123456 KS EGGS 2DZ 5.29 N //free range`. */
export const RECEIPT_RE =
  /^(?:E\s+)?(\d+)\s+(.+?)\s+(\d+\.\d\d)\s+([NY])\s*(?:\/\/\s*(.*))?$/

export function parseReceipt(text) {
  const items = []
  const bad = []
  for (const line of text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)) {
    const m = line.match(RECEIPT_RE)
    if (!m) {
      bad.push(line)
      continue
    }
    const price = Number(m[3])
    items.push({
      store_product_id: m[1],
      name: m[2].replace(/\*/g, '').trim(),
      qty: 1,
      price_each: price,
      line_total: price,
      notes: m[5] || '',
      raw: { taxable: m[4] === 'Y', line },
    })
  }
  return { items, bad }
}
