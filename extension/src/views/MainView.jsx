import {
  ClipboardList,
  ExternalLink,
  Receipt,
  ShoppingCart,
  ListTodo,
} from 'lucide-react'

import { APP_LINKS, STORE_LINKS } from '../links.js'

const open = (url) => chrome.tabs.create({ url })

/** Landing view: import from the active tab, open My List, or go to a store. */
export function MainView({
  site,
  busy,
  pendingNew,
  onImport,
  onPaste,
  onFeed,
}) {
  return (
    <div className="main-view">
      <section className="panel-card">
        <h2>Import from this tab</h2>
        <p className="small">
          {site
            ? `${site.name} — ${site.hint}`
            : 'Open Walmart, Costco (Instacart) or Aldi to import items.'}
        </p>
        <button
          className="big-btn"
          disabled={!site?.order || busy}
          onClick={() => onImport(site.order)}
          title={
            site && !site.order
              ? `No order import for ${site.name} yet`
              : undefined
          }
        >
          <ClipboardList size={22} aria-hidden="true" /> Import Ordered Items
        </button>
        <button
          className="big-btn"
          disabled={!site?.cart || busy}
          onClick={() => onImport(site.cart)}
        >
          <ShoppingCart size={22} aria-hidden="true" /> Import Items from Cart
        </button>
        <button className="big-btn secondary" disabled={busy} onClick={onPaste}>
          <Receipt size={22} aria-hidden="true" /> Paste Costco Receipt
        </button>
        {pendingNew > 0 && (
          <button className="text-btn" onClick={onFeed}>
            Continue capture feed ({pendingNew} new)
          </button>
        )}
      </section>

      <button className="add-btn" onClick={() => open(APP_LINKS.myList)}>
        <ListTodo size={22} aria-hidden="true" /> Open My List
      </button>

      <section className="panel-card">
        <h2>Stores</h2>
        {STORE_LINKS.map((l) => (
          <button
            key={l.store}
            className="link-row"
            onClick={() => open(l.url)}
          >
            <span className={`s-${l.store}`}>{l.label}</span>
            <ExternalLink size={16} aria-hidden="true" />
          </button>
        ))}
      </section>
    </div>
  )
}
