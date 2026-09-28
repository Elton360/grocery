/** "Today", "Yesterday", "3 days ago", else MM/DD/YYYY. */
import { usDate } from '../../../shared/format.js'

export function relativeDay(iso) {
  if (!iso) return ''
  const days = Math.round((Date.now() - Date.parse(`${iso}T00:00:00`)) / 864e5)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return usDate(iso)
}
