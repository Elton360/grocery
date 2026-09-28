// Instacart-storefront cart panel (instacart.com and aldi.us). Open the cart first.
// Ids come from React fiber props — same logic as tools/instacart_dump.js.
;(() => {
  const money = (s) => {
    const m = (s || '').match(/\$(\d+(?:,\d{3})*\.\d\d)/)
    return m ? Number(m[1].replace(/,/g, '')) : null
  }

  function findProps(v, depth, seen) {
    if (
      !v ||
      typeof v !== 'object' ||
      depth > 5 ||
      seen.has(v) ||
      v.$$typeof ||
      v instanceof Node
    )
      return null
    seen.add(v)
    if ('product_id' in v || 'productId' in v) return v
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('_') || Array.isArray(val) || typeof val === 'function')
        continue
      const hit = findProps(val, depth + 1, seen)
      if (hit) return hit
    }
    return null
  }

  const isAldi = location.hostname.endsWith('aldi.us')
  const store = isAldi ? 'aldi' : 'instacart'
  const productBase = isAldi
    ? 'https://www.aldi.us/store/aldi/products/'
    : 'https://www.instacart.com/products/'
  let priceMode = 'online'
  if (isAldi) {
    // Aldi's online (pickup/delivery) prices run ~10-13% above shelf prices; only In-Store mode shows shelf prices
    const mode = (document.body.innerText.match(
      /\b(In-Store|Pickup|Delivery) ·/,
    ) || [])[1]
    if (mode !== 'In-Store') {
      return {
        error:
          'Aldi is in ' +
          (mode || 'an online') +
          ' mode — its prices run ~10–13% above in-store. Switch to In-Store (top right), open your list, then grab again.',
      }
    }
    priceMode = 'in_store'
  }
  const cart = document.querySelector(
    '[data-testid="flat-item-list"], #flat-item-list',
  )
  if (!cart)
    return {
      error: isAldi
        ? 'List not found — open your ALDI list (list icon, top right), then grab again.'
        : 'Cart not found — open the cart panel, then grab again.',
    }

  const items = [...cart.querySelectorAll('[role=group][aria-label]')].map(
    (el) => {
      const fk = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
      let f = fk && el[fk],
        props = null
      for (let d = 0; f && d < 8 && !props; d++, f = f.return)
        props = findProps(f.memoizedProps, 0, new WeakSet())
      const text = el.innerText
      const cur = money((text.match(/Current price\s*\$[\d,.]+/) || [])[0])
      const orig = money((text.match(/Original price\s*\$[\d,.]+/) || [])[0])
      const price = cur ?? money(text)
      const q = text.match(/Quantity:\s*([\d.]+)\s*(\w+)/)
      const productId = props ? String(props.product_id ?? props.productId) : ''
      const img = el.querySelector('img[alt]')
      return {
        store_product_id: productId,
        name: el.getAttribute('aria-label'),
        qty: q ? Number(q[1]) : 1,
        price_each: price,
        line_total:
          price !== null && q
            ? Math.round(price * Number(q[1]) * 100) / 100
            : price,
        url: productId ? productBase + productId : '',
        image_url: img?.src || '',
        notes:
          cur !== null && orig !== null
            ? 'promo $' + cur.toFixed(2) + ' (was $' + orig.toFixed(2) + ')'
            : '',
        raw: {
          item_id: props ? String(props.item_id ?? props.itemId ?? '') : '',
          original_price: orig ?? price,
          retailer: location.pathname.split('/')[2] || '',
        },
      }
    },
  )

  return {
    store,
    source: 'cart',
    price_mode: priceMode,
    page_url: location.href.split('?')[0],
    items,
  }
})()
