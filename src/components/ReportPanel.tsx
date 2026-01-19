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

type ReportPanelProps = {
  data: Dataset
  context?: string
}

export default function ReportPanel({
  data,
  context = '',
}: ReportPanelProps) {
  const [tone, setTone] = useState<ReportOptions['tone']>('neutre')
  const [locale, setLocale] = useState<ReportOptions['locale']>('fr')
  const [loading, setLoading] = useState(false)
  const [exporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const fsSupported = supportsFileSystemAccess()
  const [jsonInput, setJsonInput] = useState('')

  useEffect(() => {
    (async () => {
      const h = await getPersistedDirHandle()
      if (h) setDirHandle(h)
    })()
  }, [])

  const contextForPrompt = useMemo(() => {
    const userCtx = context?.trim()
    const parts = []
    if (userCtx) parts.push(`Contexte métier saisi:\n${userCtx}`)
    return parts.join('\n\n')
  }, [context])

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      let jsonsToSend: Array<{ id: string; title: string; data: unknown }> = []

      if (jsonInput.trim()) {
        // Parser les JSON séparés par //
        // IMPORTANT: on split uniquement sur une ligne qui contient seulement "//"
        // (évite de casser les URLs du type https://... ou toute chaîne contenant //)
        const parts = jsonInput
          .split(/^\s*\/\/\s*$/m)
          .map(s => s.trim())
          .filter(s => s.length > 0)
        
        if (parts.length === 0) {
          throw new Error('Aucun JSON valide trouvé')
        }

        jsonsToSend = parts.map((part, idx) => {
          try {
            const parsed = JSON.parse(part)
            if (typeof parsed === 'object' && parsed !== null) {
              // Si le JSON contient déjà id/title/data, on les utilise
              if ('id' in parsed && 'title' in parsed && 'data' in parsed) {
                return {
                  id: String(parsed.id),
                  title: String(parsed.title),
                  data: parsed.data,
                }
              }
              // Sinon, on wrap le JSON brut
              return {
                id: `json-${idx + 1}`,
                title: `Bloc JSON ${idx + 1}`,
                data: parsed,
              }
            } else {
              throw new Error(`Le JSON ${idx + 1} n'est pas un objet valide`)
            }
          } catch (e: any) {
            throw new Error(`Erreur de parsing du JSON ${idx + 1}: ${e.message}`)
          }
        })
      } else {
        // Mode normal: utiliser les données filtrées si aucun JSON n'est fourni
        jsonsToSend = [
          {
            id: 'dataset-filtre',
            title: 'Jeu de données filtré (tous graphiques confondus)',
            data,
          },
        ]
      }

      // Appel du service backend /api/report (POST) qui génère le PDF avec gpt-oss:20b
      const blob = await fetchReportPdf({
        context: contextForPrompt,
        locale,
        tone,
        jsons: jsonsToSend,
      })
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

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#9ca3af' }}>
          JSON à analyser (séparés par //)
        </label>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`Exemple avec un seul JSON:
{
  "ventes": 15000,
  "marge": 4500,
  "periode": "2024-Q1"
}

Exemple avec plusieurs JSON (séparés par //):
{
  "ventes": 15000,
  "marge": 4500
}
//
{
  "stock_actuel": 1200,
  "stock_min": 800
}
//
{
  "clients": 450,
  "nouveaux_clients": 23
}

💡 Si la zone est vide, les données filtrées des graphiques seront utilisées par défaut.`}
          style={{
            width: '100%',
            minHeight: 200,
            borderRadius: 8,
            border: '1px solid #384152',
            background: '#0b1220',
            color: 'var(--text)',
            padding: 8,
            fontFamily: 'monospace',
            fontSize: 12,
            resize: 'vertical',
          }}
        />
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
          💡 <strong>Astuce:</strong> Sépare chaque JSON par <code>//</code> sur une ligne. Pour chaque JSON, l'IA fera un résumé, puis une synthèse finale de tous les résumés.
        </div>
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
