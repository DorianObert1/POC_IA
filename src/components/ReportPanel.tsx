import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dataset, ReportOptions } from '../types'
import { fetchReportPdf } from '../lib/ollama'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import {
  chooseReportsDirectory,
  getPersistedDirHandle,
  persistDirHandle,
  saveBlobFile,
  supportsFileSystemAccess,
  timestampFilename
} from '../lib/files'

export default function ReportPanel({
  data,
  context = '',
}: {
  data: Dataset
  context?: string
}) {
  const [tone, setTone] = useState<ReportOptions['tone']>('neutre')
  const [locale, setLocale] = useState<ReportOptions['locale']>('fr')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const fsSupported = supportsFileSystemAccess()

  useEffect(() => {
    (async () => {
      const h = await getPersistedDirHandle()
      if (h) setDirHandle(h)
    })()
  }, [])

  const dataSummary = useMemo(() => summarizeDataForPrompt(data), [data])
  const contextForPrompt = useMemo(() => {
    const userCtx = context?.trim()
    const parts = []
    if (userCtx) parts.push(`Contexte métier saisi:\n${userCtx}`)
    parts.push(dataSummary)
    return parts.join('\n\n')
  }, [context, dataSummary])

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      // Appel du service backend /api/report (GET) qui génère le PDF avec gpt-oss:20b
      const blob = await fetchReportPdf({ context: contextForPrompt, locale, tone })
      const name = timestampFilename('rapport', 'pdf')

      // Téléchargement ou enregistrement dans le dossier choisi
      if (dirHandle) {
        await saveBlobFile(dirHandle, name, blob)
        setReport('Rapport généré côté serveur (PDF enregistré dans le dossier sélectionné).')
        alert('PDF généré et enregistré dans le dossier de rapports.')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setReport('Rapport généré côté serveur. Le PDF a été téléchargé.')
      }
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }


  /* ===================== UI ===================== */

  const renderedHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(report) as string),
    [report]
  )

  return (
    <div className="panel">
      <h3>Générer un rapport</h3>

      <div className="grid">
        <label>
          Ton
          <select value={tone} onChange={(e) => setTone(e.target.value as any)}>
            <option value="neutre">Neutre</option>
            <option value="executif">Exécutif</option>
            <option value="detaille">Détaillé</option>
          </select>
        </label>

        <label>
          Langue
          <select value={locale} onChange={(e) => setLocale(e.target.value as any)}>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={generate} disabled={loading || exporting}>Générer (PDF serveur)</button>
        {fsSupported && (
          <button onClick={async () => {
            const h = await chooseReportsDirectory()
            if (h) {
              setDirHandle(h)
              await persistDirHandle(h)
            }
          }}>
            {dirHandle ? 'Changer dossier Rapports' : 'Choisir dossier Rapports'}
          </button>
        )}
        {error && <span className="error">{error}</span>}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
        {dirHandle ? 'Dossier rapports sélectionné: le PDF sera enregistré directement.' : fsSupported ? 'Aucun dossier sélectionné: le PDF sera téléchargé par le navigateur.' : ''}
      </div>

      <h4>Prévisualisation</h4>
      <article
        ref={previewRef}
        className="report"
        dangerouslySetInnerHTML={{ __html: renderedHtml || 'Le rapport apparaîtra ici.' }}
      />
    </div>
  )
}

function summarizeDataForPrompt(data: Dataset) {
  if (!data.length) return 'Données filtrées: aucune ligne (vérifier les filtres).'

  const dates = data.map(d => d.date).sort()
  const period = `${dates[0]} -> ${dates[dates.length - 1]}`
  const categories = Array.from(new Set(data.map(d => d.category))).sort()

  const aggregates: Record<string, { count: number; sumA: number; sumB: number; sumC: number }> = {}
  for (const row of data) {
    const agg = aggregates[row.category] ||= { count: 0, sumA: 0, sumB: 0, sumC: 0 }
    agg.count += 1
    agg.sumA += row.metricA
    agg.sumB += row.metricB
    agg.sumC += row.metricC
  }

  const lines = Object.entries(aggregates).map(([cat, agg]) => {
    const avgA = (agg.sumA / agg.count).toFixed(1)
    const avgB = (agg.sumB / agg.count).toFixed(1)
    const avgC = (agg.sumC / agg.count).toFixed(1)
    return `- ${cat}: n=${agg.count}, moy(A)=${avgA}, moy(B)=${avgB}, moy(C)=${avgC}`
  })

  return [
    `Données filtrées (${data.length} lignes)`,
    `Période: ${period}`,
    `Catégories: ${categories.join(', ')}`,
    'Synthèse par catégorie:',
    ...lines
  ].join('\n')
}
