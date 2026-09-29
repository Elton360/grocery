import { categoryMeta } from '../../lib/meta.js'
import { MasterItemCard } from './MasterItemCard.jsx'

/** A group header bar (category, store or all) followed by its master item cards. */
export function CategoryGroup({ group, recs, expandedId, onToggle }) {
  const Icon = group.icon ?? categoryMeta(group.id).icon
  return (
    <section className="category-group">
      {group.title && (
        <h3 className="category-header">
          <span>
            <Icon size={15} aria-hidden="true" />
            {group.title}
            <span className="count-pill">{group.items.length} Curated</span>
          </span>
          {group.aside && <span className="aside">{group.aside}</span>}
        </h3>
      )}
      <div className="cards">
        {group.items.map((p) => (
          <MasterItemCard
            key={p.id}
            product={p}
            rec={recs.get(p.id)}
            expanded={expandedId === p.id}
            onToggle={() => onToggle(p.id)}
          />
        ))}
      </div>
    </section>
  )
}
