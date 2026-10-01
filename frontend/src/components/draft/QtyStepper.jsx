/** − qty + (minimum 1). */
export function QtyStepper({ name, qty, onChange, className = '' }) {
  return (
    <span className={`qty-stepper ${className}`}>
      <button
        aria-label={`Decrease quantity for ${name}`}
        disabled={qty <= 1}
        onClick={() => onChange(qty - 1)}
      >
        −
      </button>
      <span aria-live="polite">{qty}</span>
      <button
        aria-label={`Increase quantity for ${name}`}
        onClick={() => onChange(qty + 1)}
      >
        +
      </button>
    </span>
  )
}
