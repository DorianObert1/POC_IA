import { useMemo, useState } from 'react'
import './App.css'
import type { Dataset, Filters } from './types'
import { sampleData } from './lib/sampleData'
import { applyFilters } from './lib/sync'
import { ChartPanel } from './components/ChartPanel'
import { DataEditor } from './components/DataEditor'
import ReportPanel from './components/ReportPanel'
import { Link } from 'react-router-dom'

function downsampleHalf<T>(arr: T[]) { return arr.filter((_, i) => i % 2 === 0) }

function App() {
  const [data, setData] = useState<Dataset>(sampleData)
  const [filters, setFilters] = useState<Filters>({ categories: [] })
  const syncId = 'shared-sync'

  const filteredRaw = useMemo(() => applyFilters(data, filters), [data, filters])
  const filtered = useMemo(() => downsampleHalf(filteredRaw), [filteredRaw])

  return (
    <div className="container">
      <header>
        <h1>POC IA - Tableaux & Rapport</h1>
        <p>4 graphiques synchronisés + génération de rapport via Ollama (frontend only).</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/rapports" style={{ marginLeft: 'auto' }}>Voir les rapports</Link>
        </div>
      </header>

      <section className="controls">
        <DataEditor data={data} setData={setData} filters={filters} setFilters={setFilters} />
      </section>

      <section className="charts-grid">
        <div className="chart-item">
          <h3>Evolution MetricA (Ligne)</h3>
          <ChartPanel type="line" data={filtered} yKeys={[{ key: 'metricA', name: 'Metric A' }]} syncId={syncId} />
        </div>
        <div className="chart-item">
          <h3>Comparaison MetricB (Barres)</h3>
          <ChartPanel type="bar" data={filtered} yKeys={[{ key: 'metricB', name: 'Metric B' }]} syncId={syncId} />
        </div>
        <div className="chart-item">
          <h3>Tendance MetricC (Aire)</h3>
          <ChartPanel type="area" data={filtered} yKeys={[{ key: 'metricC', name: 'Metric C' }]} syncId={syncId} />
        </div>
        <div className="chart-item">
          <h3>Mix A vs B + C</h3>
          <ChartPanel type="mixed" data={filtered} yKeys={[{ key: 'metricA', name: 'A' }, { key: 'metricB', name: 'B' }, { key: 'metricC', name: 'C' }]} syncId={syncId} />
        </div>
      </section>

      <section>
        <ReportPanel
          data={filtered}
          context={filters.context || ''}
        />
      </section>

      <footer>
        <small>Configurer VITE_OLLAMA_BASE_URL si besoin. Par défaut: http://localhost:11434 (proxy dev).</small>
      </footer>
    </div>
  )
}

export default App
