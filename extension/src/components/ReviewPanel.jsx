import { STORE_NAMES, plural } from '../../../shared/format.js'
import { isIgnored, isNew } from '../hooks/useReview.js'
import { ItemLine } from './ItemLine.jsx'

/** Review a grab inside the panel: order date, skipped items, new items to keep, submit. */
export function ReviewPanel({
  review,
  busy,
  onPaste,
  onDate,
  onToggle,
  onToggleAll,
  onSubmit,
  onDiscard,
}) {
  const { grab, rows, date, paste, bad } = review
  const indexed = rows.map((r, i) => [r, i])
  const fresh = indexed.filter(([r]) => isNew(r))
  const skipped = indexed.filter(([r]) => !isNew(r))
  const count = (st) => skipped.filter(([r]) => r.status === st).length
  const listed = count('converged')
  const pending = count('pending')
  const ignored = count('ignored')
  const kept = fresh.filter(([r]) => r.keep).length

  return (
    <section className="review">
      <h2>
        Review {STORE_NAMES[grab.store]} {grab.source}
      </h2>
      {grab.page_url && <p className="small url">{grab.page_url}</p>}
      <label className="field">
        Order date
        <input
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
        />
      </label>

      {paste !== null && (
        <div className="paste">
          <label className="small" htmlFor="paste">
            Paste Costco receipt lines (e.g.{' '}
            <code>E 123456 KS EGGS 2DZ 5.29 N</code>; add <code>//note</code> to
            keep a comment)
          </label>
          <textarea
            id="paste"
            spellCheck={false}
            value={paste}
            onChange={(e) => onPaste(e.target.value)}
          />
          {bad?.length > 0 && (
            <p className="err small">
              Could not read {plural(bad.length, 'line')}: {bad.join(' | ')}
            </p>
          )}
        </div>
      )}

      {skipped.length > 0 && (
        <div className="skipped">
          <p className="notice">
            Not added:{' '}
            {[
              listed > 0 && `${plural(listed, 'item')} already on your list`,
              pending > 0 && `${plural(pending, 'item')} already pending`,
              ignored > 0 && `${plural(ignored, 'item')} on your ignore list`,
            ]
              .filter(Boolean)
              .join('; ')}
            {listed + pending > 0
              ? '. Their prices and dates are still recorded.'
              : '.'}
          </p>
          <details>
            <summary>Show {plural(skipped.length, 'skipped item')}</summary>
            {skipped.map(([r, i]) => (
              <ItemLine
                key={i}
                row={r}
                control={
                  isIgnored(r) ? (
                    <input
                      type="checkbox"
                      checked={r.restore}
                      title="Restore and add"
                      onChange={() => onToggle(i, 'restore')}
                    />
                  ) : (
                    <span className="nocheck" />
                  )
                }
              />
            ))}
          </details>
        </div>
      )}

      <div className="new-head">
        <label>
          <input
            type="checkbox"
            checked={fresh.length > 0 && kept === fresh.length}
            onChange={(e) => onToggleAll(e.target.checked)}
          />{' '}
          {kept} of {plural(fresh.length, 'new item')} kept
        </label>
      </div>
      <div className="lines">
        {fresh.map(([r, i]) => (
          <ItemLine
            key={i}
            row={r}
            off={!r.keep}
            control={
              <input
                type="checkbox"
                checked={r.keep}
                onChange={() => onToggle(i, 'keep')}
              />
            }
          />
        ))}
        {!fresh.length && (
          <p className="small empty">
            {rows.length ? 'No new items in this grab.' : 'No items yet.'}
          </p>
        )}
      </div>
      <p className="small">
        Unchecked items are removed <em>and remembered</em>, so they won’t come
        back on future grabs.
      </p>
      <div className="actions">
        <button
          className="primary"
          onClick={onSubmit}
          disabled={busy || !rows.length}
        >
          {busy ? 'Saving…' : 'Submit'}
        </button>
        <button onClick={onDiscard} disabled={busy}>
          Discard
        </button>
      </div>
    </section>
  )
}
