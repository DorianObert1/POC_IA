import { useMemo } from 'react'
import type { Dataset, Filters } from '../types'
import { categoriesFromData } from '../lib/sync'

export function DataEditor({ data, setData, filters, setFilters }: {
  data: Dataset
  setData: (d: Dataset) => void
  filters: Filters
  setFilters: (f: Filters) => void
}) {
  const categories = useMemo(() => categoriesFromData(data), [data])

  return (
    <div className="panel">
      <h3>Données et filtres</h3>
      <div className="grid" style={{ gap: 12 }}>
        <label>
          Début
          <input type="date" value={filters.startDate || ''} onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })} />
        </label>
        <label>
          Fin
          <input type="date" value={filters.endDate || ''} onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })} />
        </label>
        <label>
          Catégories
          <select
            multiple
            value={filters.categories}
            onChange={(e) => {
              const sel = Array.from(e.target.selectedOptions).map(o => o.value)
              setFilters({ ...filters, categories: sel })
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <details>
        <summary>Importer/Exporter JSON</summary>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'dataset.json'
            a.click()
            URL.revokeObjectURL(url)
          }}>Exporter</button>
          <label className="button-like">
            Importer
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const text = await file.text()
              try {
                const parsed = JSON.parse(text)
                if (Array.isArray(parsed)) setData(parsed)
                else alert('Format JSON invalide: attendu un tableau de points')
              } catch (err) {
                alert('Erreur de parsing JSON: ' + (err as Error).message)
              }
            }} />
          </label>
        </div>
      </details>
    </div>
  )
}

