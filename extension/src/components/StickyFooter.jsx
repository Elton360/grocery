import { BadgeCheck, ListPlus } from 'lucide-react'

import { money } from '../../../shared/format.js'

export const MIN_SELECTION = 1

/** Add to My List + rule and total. On Tracked/Omitted only the total row is shown. */
export function StickyFooter({ showButton, count, total, busy, onAdd }) {
  const ruleMet = count >= MIN_SELECTION
  return (
    <footer className="sticky-footer">
      {showButton && (
        <button
          className="add-btn"
          disabled={!ruleMet || busy}
          aria-describedby="add-rule"
          onClick={onAdd}
        >
          <ListPlus size={22} aria-hidden="true" />
          {busy
            ? 'Adding…'
            : `Add to My List (${count} ${count === 1 ? 'item' : 'items'} selected)`}
        </button>
      )}
      <div className="rule-row">
        {showButton ? (
          <span id="add-rule" className={`rule${ruleMet ? '' : ' unmet'}`}>
            <BadgeCheck size={16} aria-hidden="true" />
            {ruleMet ? 'Ready to add' : 'Select items to add'}
          </span>
        ) : (
          <span />
        )}
        <span className="total">Total: {money(total)}</span>
      </div>
    </footer>
  )
}
