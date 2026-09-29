/** OUT / LOW pill. `variant` "solid" (draft table) or "soft" (balanced view). */
export function StatusPill({ status, variant = 'solid' }) {
  if (status !== 'out' && status !== 'low') return null
  return (
    <span className={`status-pill ${variant} ${status}`}>
      {status === 'out' ? 'OUT' : 'LOW'}
    </span>
  )
}
