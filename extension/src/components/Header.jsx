import { ExternalLink, House, ShoppingBasket } from 'lucide-react'

import { APP_LINKS } from '../links.js'

/** Logo + title; open My List in a tab; Home returns to the main view (hidden there). */
export function Header({ subtitle, onHome }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="logo" aria-hidden="true">
          <ShoppingBasket size={24} />
        </span>
        <span>
          <span className="title">Grocery Grabber</span>
          <span className="subtitle">{subtitle}</span>
        </span>
      </div>
      <div className="header-actions">
        <button
          className="icon-btn"
          title="Open My List in a new tab"
          aria-label="Open My List in a new tab"
          onClick={() => chrome.tabs.create({ url: APP_LINKS.myList })}
        >
          <ExternalLink size={22} />
        </button>
        {onHome && (
          <button
            className="avatar"
            title="Back to main view"
            aria-label="Back to main view"
            onClick={onHome}
          >
            <House size={20} />
          </button>
        )}
      </div>
    </header>
  )
}
