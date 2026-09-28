import { navigate } from '../router.js'

/** In-app link: plain clicks navigate without a page load; modified clicks open normally. */
export function Link({ to, children, ...rest }) {
  const onClick = (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} onClick={onClick} {...rest}>
      {children}
    </a>
  )
}
