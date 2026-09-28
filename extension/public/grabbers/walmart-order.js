// Walmart order detail page (walmart.com/orders/<id>). Selectors mirror parse_walmart in grocery/parsers.py.
;(() => {
  const money = (s) => {
    const m = (s || '').match(/\$(\d+(?:,\d{3})*\.\d\d)/)
    return m ? Number(m[1].replace(/,/g, '')) : null
  }
  const UNIT_RE = /(\$?\d+(?:\.\d+)?\s?¢?)\/(fl oz|oz|lb|ea|ct|count)/
  const MONTHS = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  }

  function orderDate() {
    const t = document.body.innerText
    const m =
      t.match(
        /(?:Picked up|Delivered|Arrived|Ordered|Placed)(?: on)?\s+(?:[A-Za-z]+,\s+)?([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,\s*(\d{4}))?/,
      ) || t.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})\s+order/i)
    if (!m) return ''
    const mon = MONTHS[m[1].toLowerCase()]
    if (mon === undefined) return ''
    const now = new Date()
    const year = m[3] ? Number(m[3]) : now.getFullYear()
    let d = new Date(year, mon, Number(m[2]))
    if (!m[3] && d > now) d = new Date(year - 1, mon, Number(m[2]))
    return d.toLocaleDateString('en-CA')
  }

  const tiles = [...document.querySelectorAll('[data-testid="itemtile-stack"]')]
  if (!tiles.length)
    return {
      error:
        'No order items found — open a Walmart order detail page (Account → Purchase history → an order).',
    }

  const items = tiles.map((tile) => {
    const name =
      tile.querySelector('[data-testid="productName"]')?.innerText.trim() || ''
    const link = tile.querySelector('a[href*="/ip/"]')
    const href = link
      ? new URL(link.getAttribute('href'), location.origin).href.split('?')[0]
      : ''
    const id = href ? href.replace(/\/$/, '').split('/').pop() : ''
    const text = tile.innerText
    const qty = Number((text.match(/Qty (\d+)/) || [])[1] || 1)
    const lineTotal = money(
      tile.querySelector('[data-testid="line-price"]')?.innerText,
    )
    const each = money(
      tile.querySelector('[data-testid="item-price"]')?.innerText,
    )
    const descLines = [
      ...(tile
        .querySelector('[data-testid="productDescription"]')
        ?.querySelectorAll('div') || []),
    ]
      .map((d) => d.innerText.trim())
      .filter(Boolean)
    const unit = descLines.find((d) => UNIT_RE.test(d)) || ''
    const variants = descLines.filter(
      (d) => !UNIT_RE.test(d) && !d.startsWith('Multipack Quantity'),
    )
    const was = money((text.match(/Was \$[\d,.]+/) || [])[0])
    const ordered = money((text.match(/Ordered price \$[\d,.]+/) || [])[0])
    const notes = [
      ordered !== null && 'ordered $' + ordered.toFixed(2),
      was !== null && 'was $' + was.toFixed(2),
      variants.join('; '),
      tile.closest('[data-testid*="substituted"]') && 'substitution',
    ]
      .filter(Boolean)
      .join(' | ')
    return {
      store_product_id: id,
      name,
      qty,
      line_total: lineTotal,
      price_each:
        each ??
        (lineTotal !== null ? Math.round((lineTotal / qty) * 100) / 100 : null),
      unit_price_text: unit,
      url: href,
      image_url:
        tile.querySelector('img[data-testid="productTileImage"]')?.src || '',
      notes,
    }
  })

  return {
    store: 'walmart',
    source: 'order',
    price_mode: 'online',
    order_date: orderDate(),
    page_url: location.href.split('?')[0],
    items,
  }
})()
