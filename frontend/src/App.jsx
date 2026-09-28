import { ShoppingBasket } from 'lucide-react'

import { MyListPage } from './pages/MyListPage.jsx'
import { ReviewPage } from './pages/ReviewPage.jsx'
import { Link } from './components/Link.jsx'
import { usePath } from './router.js'

const PAGES = [
  ['/my-list', 'My List', MyListPage],
  ['/review', 'Review', ReviewPage],
]

export function App() {
  const path = usePath()
  const page = PAGES.find(([p]) => p === path)
  const Page = page?.[2]
  return (
    <>
      <nav className="nav">
        <span className="brand">
          <span className="logo" aria-hidden="true">
            <ShoppingBasket size={20} />
          </span>
          Grocery
        </span>
        {PAGES.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            aria-current={to === path ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <main className={path === '/my-list' ? 'wide' : ''}>
        {Page ? <Page /> : <p className="empty">Page not found.</p>}
      </main>
    </>
  )
}
