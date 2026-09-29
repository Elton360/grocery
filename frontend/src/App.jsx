import { TopNav } from './components/TopNav.jsx'
import { DraftPage } from './pages/DraftPage.jsx'
import { MyListPage } from './pages/MyListPage.jsx'
import { ReviewPage } from './pages/ReviewPage.jsx'
import { usePath } from './router.js'

const PAGES = [
  ['/my-list', 'My List', MyListPage],
  ['/draft', 'Draft Grocery List', DraftPage],
  ['/review', 'Review', ReviewPage],
]

export function App() {
  const path = usePath()
  const Page = PAGES.find(([p]) => p === path)?.[2]
  return (
    <>
      <TopNav path={path} pages={PAGES} />
      {path === '/my-list' || path === '/draft' ? (
        <Page />
      ) : (
        <main>
          {Page ? <Page /> : <p className="empty">Page not found.</p>}
        </main>
      )}
    </>
  )
}
