import { TopNav } from './components/TopNav.jsx'
import { MyListPage } from './pages/MyListPage.jsx'
import { ReviewPage } from './pages/ReviewPage.jsx'
import { usePath } from './router.js'

const PAGES = [
  ['/my-list', 'My List', MyListPage],
  ['/review', 'Review', ReviewPage],
]

export function App() {
  const path = usePath()
  const Page = PAGES.find(([p]) => p === path)?.[2]
  return (
    <>
      <TopNav path={path} pages={PAGES} />
      {path === '/my-list' ? (
        <MyListPage />
      ) : (
        <main>
          {Page ? <Page /> : <p className="empty">Page not found.</p>}
        </main>
      )}
    </>
  )
}
