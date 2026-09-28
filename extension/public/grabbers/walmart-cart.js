// Walmart cart page (walmart.com/cart). One product-tile-container can hold several items, so each item
// is the nearest ancestor of its productName that has its own quantity stepper.
;(() => {
  const money = (s) => {
    const m = (s || '').match(/\$(\d+(?:,\d{3})*\.\d\d)/)
    return m ? Number(m[1].replace(/,/g, '')) : null
  }
  const root = document.querySelector('[data-testid="cart-page"]')
  if (!root)
    return { error: 'Cart not found — open walmart.com/cart, then grab again.' }

  const names = [
    ...root.querySelectorAll('[data-testid="productName"]'),
  ].filter((n) => !n.closest('[data-testid="recommendation-containers-group"]'))
  const items = names.map((n) => {
    let tile = n
    while (
      tile.parentElement &&
      tile !== root &&
      !tile.querySelector('[data-testid="quantity-stepper"]')
    )
      tile = tile.parentElement
    const link = tile.querySelector('a[href*="/ip/"]')
    const href = link
      ? new URL(link.getAttribute('href'), location.origin).href.split('?')[0]
      : ''
    const text = tile.innerText
    const qty =
      Number(
        tile.querySelector('[data-testid="quantity-label"]')?.innerText || 1,
      ) || 1
    const lineTotal = money(text)
    const each = money((text.match(/\$[\d,.]+\s*ea\b/) || [])[0])
    const was = money((text.match(/Was \$[\d,.]+/) || [])[0])
    const unit =
      (text.match(/\$?\d+(?:\.\d+)?\s?¢?\/(?:fl oz|oz|lb|ea|ct|count)/) ||
        [])[0] || ''
    return {
      store_product_id: href ? href.replace(/\/$/, '').split('/').pop() : '',
      name: n.innerText.trim(),
      qty,
      line_total: lineTotal,
      price_each:
        each ??
        (lineTotal !== null ? Math.round((lineTotal / qty) * 100) / 100 : null),
      unit_price_text: unit,
      url: href ? 'https://www.walmart.com/ip/' + href.split('/').pop() : '',
      image_url: tile.querySelector('img')?.src || '',
      notes: was !== null ? 'was $' + was.toFixed(2) : '',
    }
  })

  return {
    store: 'walmart',
    source: 'cart',
    price_mode: 'online',
    page_url: location.href.split('?')[0],
    items,
  }
})()
