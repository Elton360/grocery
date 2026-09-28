import { useMemo, useState } from 'react'

import { plural } from '../../../shared/format.js'
import { ItemList } from '../components/ItemList.jsx'
import { SelectionToolbar } from '../components/SelectionToolbar.jsx'
import { StickyFooter } from '../components/StickyFooter.jsx'
import { StoreStatusBar } from '../components/StoreStatusBar.jsx'
import { TabBar } from '../components/TabBar.jsx'

/** Capture feed: New | Tracked | Omitted, select new items and add them to My List. */
export function FeedView({ feed, ready, live, tab, onTab, actions, notify }) {
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(null) // 'add' or an item key

  const byStatus = useMemo(() => {
    const out = { new: [], tracked: [], omitted: [] }
    for (const f of feed.items) out[f.status].push(f)
    return out
  }, [feed.items])
  const shown = byStatus[tab]
  // selection only ever refers to items still in New
  const newKeys = new Set(byStatus.new.map((f) => f.key))
  const chosen = [...selected].filter((k) => newKeys.has(k))
  const totalOf = (list) =>
    list.reduce((sum, f) => sum + (Number(f.item.price_each) || 0), 0)
  const total =
    tab === 'new'
      ? totalOf(byStatus.new.filter((f) => selected.has(f.key)))
      : totalOf(shown)

  const toggle = (key) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  async function run(key, fn, success) {
    setBusy(key)
    try {
      await fn()
      if (success) notify({ text: success })
    } catch (e) {
      notify({ error: true, text: e.message })
    } finally {
      setBusy(null)
    }
  }

  const add = () =>
    run(
      'add',
      async () => {
        await actions.addToList(chosen)
        setSelected(new Set())
      },
      `${plural(chosen.length, 'item')} added to My List`,
    )

  return (
    <div className="feed-view">
      <div className="pinned">
        <StoreStatusBar captures={feed.captures} live={live} />
        <TabBar
          tab={tab}
          onChange={onTab}
          counts={{
            new: byStatus.new.length,
            tracked: byStatus.tracked.length,
            omitted: byStatus.omitted.length,
          }}
        />
        {tab === 'new' && (
          <SelectionToolbar
            anySelected={chosen.length > 0}
            disabled={!byStatus.new.length}
            onToggleAll={() => setSelected(chosen.length ? new Set() : newKeys)}
          />
        )}
      </div>
      <ItemList
        tab={tab}
        items={shown}
        loading={!ready}
        selected={selected}
        busyKey={busy}
        onToggle={toggle}
        onOmit={(key) =>
          run(
            key,
            () => actions.omit(key),
            'Omitted — future imports will skip it',
          )
        }
        onRestore={(key) =>
          run(key, () => actions.restore(key), 'Added to My List')
        }
      />
      <StickyFooter
        showButton={tab === 'new'}
        count={chosen.length}
        total={total}
        busy={busy === 'add'}
        onAdd={add}
      />
    </div>
  )
}
