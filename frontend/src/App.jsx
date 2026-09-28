import { ComparePage } from './pages/ComparePage.jsx'
import { ListPage } from './pages/ListPage.jsx'
import { ReviewPage } from './pages/ReviewPage.jsx'
import { Link } from './components/Link.jsx'
import { usePath } from './router.js'

const PAGES = [
  ['/compare', 'Compare', ComparePage],
  ['/list', 'List', ListPage],
  ['/review', 'Review', ReviewPage],
]

export function App() {
  const path = usePath()
  const page = PAGES.find(([p]) => p === path)
  const Page = page?.[2]
  return (
    <>
      <nav className="nav">
        <b>Grocery</b>
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
      <main className={path === '/compare' ? 'wide' : ''}>
        {Page ? <Page /> : <p className="empty">Page not found.</p>}
      </main>
    </>
  )
}
