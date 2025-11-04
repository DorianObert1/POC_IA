import { useMemo, useRef, useState } from 'react'
import type { Dataset, ReportOptions } from '../types'
import { callOllama, pingOllama, listModels, callOllamaChat } from '../lib/ollama'
import { buildReportPrompt } from '../lib/report'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import html2pdf from 'html2pdf.js'

export function ReportPanel({ data, images = [] as string[] }: { data: Dataset; images?: string[] }) {
  const [model, setModel] = useState('llama3.1:8b')
  const [models, setModels] = useState<string[]>([])
  const [tone, setTone] = useState<ReportOptions['tone']>('neutre')
  const [locale, setLocale] = useState('fr')
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState('')
  const [testInfo, setTestInfo] = useState<string>('')
  const previewRef = useRef<HTMLDivElement>(null)

  const prompt = useMemo(() => buildReportPrompt(data, { tone, locale }), [data, tone, locale])

  async function testApi() {
    setTesting(true)
    setError(null)
    setTestInfo('')
    const res = await pingOllama().catch((e) => ({ ok: false, message: e.message || String(e), endpoint: '' }))
    setTesting(false)
    const status = (res as any).status as number | undefined
    const statusText = (res as any).statusText as string | undefined
    if (!res.ok) {
      const msg = res.message ?? (typeof status === 'number' ? `${status} ${statusText || ''}` : 'échec')
      setError(`Test API: ${msg}`)
      const body = (res as any).body ? String((res as any).body).slice(0, 400) : ''
      setTestInfo(`endpoint=${res.endpoint || ''}\nstatus=${status ?? ''} ${statusText || ''}\nbody=${body}`)
    } else {
      const count = (res as any).modelsCount as number | undefined
      setTestInfo(`endpoint=${res.endpoint || ''}\nstatus=${status ?? ''} ${statusText || ''}\nOK${typeof count === 'number' ? ` – modèles: ${count}` : ''}`)
      alert('API OK')
    }
  }

  async function refreshModels() {
    setTesting(true)
    setError(null)
    try {
      const ms = await listModels()
      setModels(ms)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setTesting(false)
    }
  }

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      // D’abord tenter chat avec images si disponibles
      if (images.length) {
        const input = `${prompt}\n\nTu disposes de ${images.length} graphiques joints (PNG). Tiens-en compte pour l’analyse.`
        const textChat = await callOllamaChat(input, model)
        setReport(textChat)
      } else {
        const text = await callOllama({ model, prompt })
        setReport(text)
      }
    } catch (e: any) {
      try {
        const text = await callOllama({ model, prompt })
        setReport(text)
      } catch (e2: any) {
        setError((e2?.message || e?.message || String(e2 || e)))
      }
    } finally {
      setLoading(false)
    }
  }

  async function downloadPdf() {
    if (!report || !previewRef.current || exporting) return
    setExporting(true)
    const el = previewRef.current
    // Mémoriser styles pour rétablir
    const prev = {
      width: el.style.width,
      background: el.style.background,
      padding: el.style.padding,
      boxSizing: el.style.boxSizing,
    }
    el.style.width = '794px' // ~A4 @96dpi
    el.style.background = '#ffffff'
    el.style.padding = '16px'
    el.style.boxSizing = 'border-box'
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const opt = {
        margin: [10, 10, 10, 10],
        filename: 'rapport.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: el.scrollWidth, foreignObjectRendering: true },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      } as any
      await (html2pdf() as any).set(opt).from(el).save()
    } finally {
      el.style.width = prev.width
      el.style.background = prev.background
      el.style.padding = prev.padding
      el.style.boxSizing = prev.boxSizing
      setExporting(false)
    }
  }

  function printPdfFallback() {
    if (!report) return
    const rawHtml = marked.parse(report) as string
    const safeHtml = DOMPurify.sanitize(rawHtml)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Rapport</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: Arial, sans-serif; color: #111; }
        h1,h2,h3 { margin: 0 0 8px; }
        p { margin: 0 0 8px; }
        ul, ol { margin: 0 0 8px 18px; }
        table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        code { background: #f4f4f4; padding: 0 3px; }
        hr { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
        h1, h2 { page-break-after: avoid; }
        h3 { page-break-inside: avoid; }
        table, pre, blockquote { page-break-inside: avoid; }
      </style>
    </head><body><article>${safeHtml}</article></body></html>`)
    win.document.close()
    win.focus()
    // attendre le rendu puis imprimer
    setTimeout(() => { try { win.print() } catch {} }, 300)
  }

  const renderedHtml = useMemo(() => {
    if (!report) return ''
    const raw = marked.parse(report) as string
    return DOMPurify.sanitize(raw)
  }, [report])

  return (
    <div className="panel">
      <h3>Générer un rapport</h3>
      <div className="grid" style={{ gap: 12 }}>
        <label>
          Modèle
          <input list="ollama-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder="ex: llama3.1:8b" />
          <datalist id="ollama-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
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
          <select value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button disabled={testing} onClick={testApi}>{testing ? 'Test...' : 'Tester API'}</button>
        <button disabled={testing} onClick={refreshModels}>{testing ? 'Chargement modèles…' : 'Lister modèles'}</button>
        <button disabled={loading} onClick={generate}>{loading ? 'Génération...' : 'Générer le rapport'}</button>
        <button disabled={!report || exporting} onClick={downloadPdf}>{exporting ? 'Export…' : 'Télécharger PDF'}</button>
        <button disabled={!report} onClick={printPdfFallback}>Imprimer (PDF propre)</button>
        {error && <span className="error">{error}</span>}
      </div>
      {testInfo && (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.85, marginTop: 8 }}>{testInfo}</pre>
      )}
      <details style={{ marginTop: 8 }}>
        <summary>Voir le prompt</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{prompt}</pre>
      </details>
      <h4>Prévisualisation</h4>
      <article ref={previewRef} className="report" style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #eee' }}
        dangerouslySetInnerHTML={{ __html: (DOMPurify.sanitize(marked.parse(report) as string)) || 'Le rapport généré apparaîtra ici.' }}
      />
      {!!images.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
          {images.map((src, idx) => (
            <figure key={idx} style={{ margin: 0 }}>
              <img src={src} alt={`graph-${idx+1}`} style={{ width: '100%', height: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 8 }} />
              <figcaption style={{ fontSize: 12, opacity: 0.7 }}>Graphique {idx+1}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
