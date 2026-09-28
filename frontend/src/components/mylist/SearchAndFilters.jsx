import { Search } from 'lucide-react'

import { categoryMeta } from '../../lib/meta.js'

/** Search box + single-select category chips (counts from the data). */
export function SearchAndFilters({
  query,
  onQuery,
  categories,
  category,
  onCategory,
  total,
}) {
  return (
    <div className="search-filters">
      <label className="search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search groceries, brands, store SKUs (e.g., 'Organic Bananas' or 'Costco')..."
          aria-label="Search groceries"
        />
      </label>
      <div className="chips" role="radiogroup" aria-label="Category">
        <button
          role="radio"
          aria-checked={!category}
          className={`chip${!category ? ' active' : ''}`}
          onClick={() => onCategory('')}
        >
          All ({total})
        </button>
        {categories.map(([id, count]) => (
          <button
            key={id}
            role="radio"
            aria-checked={category === id}
            className={`chip${category === id ? ' active' : ''}`}
            onClick={() => onCategory(id)}
          >
            {categoryMeta(id).name} ({count})
          </button>
        ))}
      </div>
    </div>
  )
}
