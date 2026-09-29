/** Banner text and row tags for the auto-balanced view, both derived from the draft lines' reasons. */
import { money } from '../../../../shared/format.js'
import { STORE_META } from '../../lib/meta.js'

const storeName = (s) => STORE_META[s]?.name ?? s

/** Up to 2 tags per row: [{text, kind, title}]. */
export function tagsFor(line, anchor) {
  if (!line.store) return []
  if (line.reason === 'gap') {
    return line.preferred
      ? [
          {
            text: '★ Preferred',
            kind: 'preferred',
            title: 'Your preferred pick',
          },
          {
            text: 'Moved from unassigned',
            kind: 'moved',
            title: `Not carried at ${storeName(anchor)}`,
          },
        ]
      : [
          {
            text: 'Moved to cover gap',
            kind: 'gap',
            title: `Not carried at ${storeName(anchor)}`,
          },
        ]
  }
  if (line.reason === 'preferred') {
    return [
      { text: '★ Preferred', kind: 'preferred', title: 'Your preferred pick' },
    ]
  }
  if (line.reason === 'cheapest' && line.store !== anchor) {
    return [
      {
        text: `${storeName(line.store)} Best Price`,
        kind: 'gap',
        title: `At least 10% cheaper than at ${storeName(anchor)}`,
      },
    ]
  }
  return []
}

/** Meta line for a row: category (and savings when there is some). */
export function metaFor(line, categoryName) {
  const parts = [categoryName]
  if (line.savesVs) parts.push(`Saves ${money(line.savesVs)} vs the next store`)
  return parts.join(' • ')
}

const list = (xs) =>
  xs.length <= 1
    ? xs.join('')
    : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`

/** "Since you're stopping at Walmart anyway, we balanced … Moved: …" from the same lines as the tags. */
export function bannerText(result, anchor) {
  const added = result.stores.filter((s) => s !== anchor).map(storeName)
  const moved = result.lines
    .filter((l) => l.store && l.store !== anchor)
    .map((l) =>
      l.preferred && (l.reason === 'preferred' || l.reason === 'gap')
        ? `your preferred ${storeName(l.store)} ${l.name.toLowerCase()}`
        : l.reason === 'gap'
          ? `${l.name} (not at ${storeName(anchor)})`
          : `${l.name}, cheaper there`,
    )
  return {
    lead: `Since you're stopping at ${list(added)} anyway, we balanced your list across `,
    stores: [anchor, ...result.stores.filter((s) => s !== anchor)]
      .map(storeName)
      .join(' + '),
    moved: moved.length ? `Moved: ${list(moved)}.` : 'Nothing needed to move.',
  }
}
