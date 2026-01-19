import express from 'express'
import cors from 'cors'
import PDFDocument from 'pdfkit'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Config
const HOST = process.env.OLLAMA_HOST || 'https://ollama.com'
const TOKEN = process.env.OLLAMA_TOKEN || 'c5de47c405764d8799cabddcf077fd9c.5Nj6RfuNBYJZQzNnZHmtug3C'
const PORT = process.env.PORT || 8787
const TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 100000)

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`
  return headers
}

function withTimeout(signal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Request timeout')), TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => controller.abort())
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

app.get('/health', (req, res) => {
  res.json({ host: HOST, hasToken: Boolean(TOKEN), port: PORT })
})

app.get('/api/version', async (req, res) => {
  const url = `${HOST}/api/version`
  const t = withTimeout()
  try {
    const r = await fetch(url, { headers: authHeaders(), signal: t.signal })
    const ct = r.headers.get('content-type') || ''
    const body = ct.includes('application/json') ? await r.json() : await r.text()
    res.status(r.status).send(body)
  } catch (e) {
    console.error('GET', url, 'failed:', e)
    res.status(500).send({ error: 'fetch failed', message: e?.message || String(e), code: e?.cause?.code, hostname: e?.cause?.hostname, syscall: e?.cause?.syscall })
  } finally {
    t.clear()
  }
})

app.get('/api/tags', async (req, res) => {
  const url = `${HOST}/api/tags`
  const t = withTimeout()
  try {
    const r = await fetch(url, { headers: authHeaders(), signal: t.signal })
    const ct = r.headers.get('content-type') || ''
    const body = ct.includes('application/json') ? await r.json() : await r.text()
    res.status(r.status).send(body)
  } catch (e) {
    console.error('GET', url, 'failed:', e)
    res.status(500).send({ error: 'fetch failed', message: e?.message || String(e), code: e?.cause?.code, hostname: e?.cause?.hostname, syscall: e?.cause?.syscall })
  } finally {
    t.clear()
  }
})

app.post('/api/generate', async (req, res) => {
  const url = `${HOST}/api/generate`
  const t = withTimeout()
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req.body),
      signal: t.signal,
    })
    const ct = r.headers.get('content-type') || ''
    const body = ct.includes('application/json') ? await r.json() : await r.text()
    res.status(r.status).send(body)
  } catch (e) {
    console.error('POST', url, 'failed:', e)
    res.status(500).send({ error: 'fetch failed', message: e?.message || String(e), code: e?.cause?.code, hostname: e?.cause?.hostname, syscall: e?.cause?.syscall })
  } finally {
    t.clear()
  }
})

app.post('/api/chat', async (req, res) => {
  const url = `${HOST}/api/chat`
  const t = withTimeout()
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req.body),
      signal: t.signal,
    })
    const ct = r.headers.get('content-type') || ''
    const body = ct.includes('application/json') ? await r.json() : await r.text()
    res.status(r.status).send(body)
  } catch (e) {
    console.error('POST', url, 'failed:', e)
    res.status(500).send({ error: 'fetch failed', message: e?.message || String(e), code: e?.cause?.code, hostname: e?.cause?.hostname, syscall: e?.cause?.syscall })
  } finally {
    t.clear()
  }
})

// Génération de rapport + PDF côté serveur (modèle fixé à gpt-oss:20b)
app.get('/api/report', async (req, res) => {
  const { context = '', locale = 'fr', tone = 'neutre' } = req.query || {}

  const title = 'Rapport de synthèse'
  const head = `Génère un rapport ${tone} en ${locale} intitulé "${title}".
- Structure en sections: Contexte, Faits marquants, Analyse, Recommandations.
- Garde un style concis (600-900 mots) avec puces là où utile.
- Harmonise le vocabulaire d’un rapport métier.
- Ne répète pas inutilement les données.`

  const ctxBlock = context
    ? `Contexte métier fourni:\n${context}\n\n`
    : ''

  const body = `${ctxBlock}Directives supplémentaires:
- Mets en évidence les tendances et écarts significatifs visibles dans les graphiques.
- Fais une analyse croisée des dimensions (catégories, périodes, indicateurs).
- Termine par des recommandations actionnables adaptées au contexte.`

  const prompt = `${head}\n\n${body}`

  const url = `${HOST}/api/chat`
  const t = withTimeout()

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: 'gpt-oss:20b',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: t.signal,
    })

    const raw = await r.text()

    // Certains backends renvoient un flux de JSON ligne par ligne (SSE-like).
    // On parcourt chaque ligne, on essaie de parser et on concatène uniquement le "message.content".
    let textChunks = []
    const lines = raw.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const obj = JSON.parse(trimmed)
        if (typeof obj?.message?.content === 'string') {
          textChunks.push(obj.message.content)
        } else if (typeof obj?.response === 'string') {
          textChunks.push(obj.response)
        }
      } catch {
        // Ignore les lignes non-JSON (ou bruit) pour ne pas polluer le rapport
      }
    }

    // Si on n'a rien récupéré, on retombe sur le texte brut complet
    const textRaw = textChunks.length ? textChunks.join('') : raw

    // Nettoyage simple du Markdown pour un rendu PDF plus propre
    const text = textRaw
      // supprimer les # de titres en conservant le texte
      .replace(/^#{1,6}\s*/gm, '')
      // supprimer le gras/italique Markdown **texte**, *texte*
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      // supprimer le code inline `texte`
      .replace(/`([^`]*)`/g, '$1')
      // simplifier les tableaux Markdown: supprimer les lignes de séparation |---| et les pipes
      .replace(/^\|?[-:| ]+\|?$/gm, '')
      .replace(/\|/g, ' ')
      // normaliser les espaces
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')

    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="rapport.pdf"')

    doc.pipe(res)
    doc.font('Times-Roman').fontSize(16).text(title, { align: 'center' })
    doc.moveDown()
    doc.fontSize(11).text(text.trim(), {
      align: 'left',
      lineGap: 4,
    })
    doc.end()
  } catch (e) {
    console.error('GET /api/report failed:', e)
    res.status(500).json({ error: 'report_generation_failed', message: e?.message || String(e) })
  } finally {
    t.clear()
  }
})

app.listen(PORT, () => {
  console.log(`Proxy Ollama server listening on http://localhost:${PORT}`)
})
