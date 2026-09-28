import { Info, ListChecks } from 'lucide-react'

export function SelectionToolbar({ anySelected, onToggleAll, disabled }) {
  return (
    <div className="selection-toolbar">
      <span className="hint">
        <Info size={16} aria-hidden="true" />
        Select new items to stage &amp; sync
      </span>
      <button className="text-btn" onClick={onToggleAll} disabled={disabled}>
        <ListChecks size={16} aria-hidden="true" />
        {anySelected ? 'Deselect All' : 'Select All'}
      </button>
    </div>
  )
}
