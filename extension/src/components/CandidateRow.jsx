import { CirclePlus } from 'lucide-react'

export function CandidateRow() {
  return (
    <div className="candidate-row">
      <span>
        <CirclePlus size={16} aria-hidden="true" />
        New master item candidate
      </span>
      <span className="new-badge">New Item</span>
    </div>
  )
}
