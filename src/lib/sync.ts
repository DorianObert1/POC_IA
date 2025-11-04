import type { Dataset, Filters } from '../types'

export function applyFilters(data: Dataset, filters: Filters): Dataset {
  return data.filter((d) => {
    if (filters.startDate && d.date < filters.startDate) return false
    if (filters.endDate && d.date > filters.endDate) return false
    if (filters.categories.length && !filters.categories.includes(d.category)) return false
    return true
  })
}

export function categoriesFromData(data: Dataset): string[] {
  return Array.from(new Set(data.map((d) => d.category)))
}
