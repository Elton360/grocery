import { X } from 'lucide-react'
import { useEffect } from 'react'

import { Link } from '../Link.jsx'
import { IgnoredSection } from '../IgnoredSection.jsx'
import { PendingSection } from '../PendingSection.jsx'

/** Pending Triage: items added from the side panel awaiting a master item, Converge, ignored items. */
export function TriageDrawer({
  open,
  onClose,
  pending,
  ignored,
  busyKey,
  onRemove,
  onRestore,
  onConverged,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Pending triage"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <h2>Pending triage</h2>
          <button className="icon-only" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="small">
          Items you added from the side panel wait here until Converge matches
          them to a master item. Approve its proposals on{' '}
          <Link to="/review">Review</Link>.
        </p>
        <PendingSection
          items={pending}
          busyKey={busyKey}
          onRemove={onRemove}
          onConverged={onConverged}
        />
        <IgnoredSection
          items={ignored}
          busyKey={busyKey}
          onRestore={onRestore}
        />
      </aside>
    </div>
  )
}
