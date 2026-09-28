import { PanelRight, ShoppingBasket, Store } from 'lucide-react'
import { useState } from 'react'

import { STORE_META } from '../lib/meta.js'
import { Link } from './Link.jsx'

/**
 * Sticky top bar: brand, monitored stores, page links, and a side panel hint
 * (a web page can't open the extension's side panel itself).
 */
export function TopNav({ path, pages }) {
  const [hint, setHint] = useState(false)
  return (
    <nav className="top-nav">
      <div className="nav-left">
        <span className="brand">
          <span className="logo" aria-hidden="true">
            <ShoppingBasket size={16} />
          </span>
          Grocery Grabber
        </span>
        <span className="location-chip">
          <Store size={12} aria-hidden="true" />
          {Object.values(STORE_META).map((s) => (
            <span key={s.name} className="loc-store">
              {s.name}
            </span>
          ))}
        </span>
        {pages.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className="nav-link"
            aria-current={to === path ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="nav-right">
        <button
          className="panel-btn"
          onClick={() => setHint((h) => !h)}
          aria-expanded={hint}
        >
          <PanelRight size={14} aria-hidden="true" />
          <span className="panel-label">Open Side Panel</span>
        </button>
        {hint && (
          <div className="hint-pop" role="status">
            Click the <b>Grocery Grabber</b> icon in Chrome’s toolbar to open
            the side panel. (Web pages can’t open it for you.)
          </div>
        )}
      </div>
    </nav>
  )
}
