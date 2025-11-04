import type { Dataset } from '../types'

export const sampleData: Dataset = Array.from({ length: 24 }, (_, i) => {
  const month = (i % 12) + 1
  const year = 2024 + Math.floor(i / 12)
  const date = `${year}-${String(month).padStart(2, '0')}-01`
  const categories = ['Nord', 'Sud', 'Est', 'Ouest']
  const category = categories[i % categories.length]
  const base = 100 + i * 5
  return {
    id: `${date}-${category}`,
    date,
    category,
    metricA: Math.round(base + Math.random() * 20),
    metricB: Math.round(base * 0.8 + Math.random() * 15),
    metricC: Math.round(50 + (i % 6) * 10 + Math.random() * 5),
  }
})
