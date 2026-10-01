/** Stage 3 entry. Shopping mode is tracked in issue #11; until then the button explains that. */
export function StartShopping({ children, className = 'btn-dark' }) {
  return (
    <button
      className={className}
      disabled
      title="Shopping mode is coming next (issue #11)"
    >
      {children}
    </button>
  )
}
