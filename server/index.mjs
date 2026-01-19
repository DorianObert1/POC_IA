import express from 'express'
import cors from 'cors'
import PDFDocument from 'pdfkit'

/**
 * API de génération de rapports PDF avec IA
 * 
 * ENDPOINT GET /api/report (pour intégration facile depuis d'autres plateformes)
 * 
 * Paramètres query :
 * - context (string, optionnel) : Contexte métier pour le rapport
 * - locale (string, défaut: 'fr') : Langue du rapport ('fr' ou 'en')
 * - tone (string, défaut: 'neutre') : Ton du rapport ('neutre', 'executif', 'detaille')
 * - jsons_base64 (string, optionnel) : JSON encodé en base64 pour le chaînage IA
 * 
 * Exemple 1 - Rapport simple (sans JSON) :
 * GET /api/report?context=Analyse%20des%20ventes%20Q1&locale=fr&tone=executif
 * 
 * Exemple 2 - Rapport avec JSON (chaînage IA) :
 * 1) Préparer le JSON (tableau de blocs) :
 *    [
 *      { "id": "ventes", "title": "Données ventes", "data": { "ventes": 15000, "marge": 4500 } },
 *      { "id": "stocks", "title": "Niveaux stock", "data": { "stock": 1200 } }
 *    ]
 * 2) Encoder en base64 (ex: en JavaScript: btoa(JSON.stringify(jsonArray)))
 * 3) Appeler : GET /api/report?context=...&jsons_base64=W3siaWQiOiJ2ZW50ZXM...
 * 
 * Retour : PDF binaire (Content-Type: application/pdf)
 */

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

function extractTextFromOllamaRaw(raw) {
  // Certains backends renvoient un flux de JSON ligne par ligne (SSE-like).
  // On parcourt chaque ligne, on essaie de parser et on concatène uniquement le texte utile.
  let textChunks = []
  const lines = String(raw || '').split('\n')
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
      // ignore
    }
  }
  return textChunks.length ? textChunks.join('') : String(raw || '')
}

function cleanMarkdownForPdf(textRaw) {
  return String(textRaw || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\|?[-:| ]+\|?$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

function coerceChartsFromBody(charts) {
  if (!Array.isArray(charts)) return null
  const cleaned = charts
    .map((c, idx) => {
      if (!c || typeof c !== 'object') return null
      const id = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `chart${idx + 1}`
      const title = typeof c.title === 'string' && c.title.trim() ? c.title.trim() : id
      const metrics = Array.isArray(c.metrics)
        ? c.metrics.filter(m => typeof m === 'string' && m.trim()).map(m => m.trim())
        : []
      if (!metrics.length) return null
      return { id, title, metrics }
    })
    .filter(Boolean)
  return cleaned.length ? cleaned : null
}

function summarizeSeries(data, metrics) {
  // data: [{date, category, metricA, metricB, metricC, ...}]
  if (!Array.isArray(data) || !data.length || !Array.isArray(metrics) || !metrics.length) {
    return { totalPoints: 0 }
  }

  const dates = data.map(d => d.date).filter(Boolean).sort()
  const period = dates.length ? `${dates[0]} -> ${dates[dates.length - 1]}` : ''
  const categories = Array.from(new Set(data.map(d => d.category))).filter(Boolean).sort()

  // agrégats par catégorie et global
  const byCat = {}
  const global = { count: 0 }
  for (const m of metrics) {
    global[`sum_${m}`] = 0
    global[`min_${m}`] = Number.POSITIVE_INFINITY
    global[`max_${m}`] = Number.NEGATIVE_INFINITY
  }

  for (const row of data) {
    const cat = row.category || '—'
    const agg = byCat[cat] ||= { count: 0 }
    agg.count += 1
    global.count += 1
    for (const m of metrics) {
      const v = Number(row[m])
      if (!Number.isFinite(v)) continue
      agg[`sum_${m}`] = (agg[`sum_${m}`] || 0) + v
      if (v < global[`min_${m}`]) global[`min_${m}`] = v
      if (v > global[`max_${m}`]) global[`max_${m}`] = v
      global[`sum_${m}`] += v
    }
  }

  const byCategory = Object.entries(byCat).map(([cat, agg]) => {
    const out = { category: cat, n: agg.count }
    for (const m of metrics) {
      const avg = (Number(agg[`sum_${m}`] || 0) / Math.max(1, agg.count))
      out[`avg_${m}`] = Number(avg.toFixed(2))
    }
    return out
  })

  const globalStats = {}
  for (const m of metrics) {
    const avg = global[`sum_${m}`] / Math.max(1, global.count)
    globalStats[m] = {
      avg: Number(avg.toFixed(2)),
      min: Number.isFinite(global[`min_${m}`]) ? global[`min_${m}`] : null,
      max: Number.isFinite(global[`max_${m}`]) ? global[`max_${m}`] : null,
    }
  }

  return { totalPoints: global.count, period, categories, global: globalStats, byCategory }
}

function coerceJsonBlocks(jsons, data, charts) {
  // 1) Cas nominal: le client envoie directement des blocs JSON
  if (Array.isArray(jsons)) {
    const blocks = jsons
      .map((b, idx) => {
        if (!b || typeof b !== 'object') return null
        const anyB = b
        if (!('data' in anyB)) return null
        const id = typeof anyB.id === 'string' && anyB.id.trim() ? anyB.id.trim() : `block${idx + 1}`
        const title = typeof anyB.title === 'string' && anyB.title.trim() ? anyB.title.trim() : id
        return { id, title, data: anyB.data }
      })
      .filter(Boolean)
    if (blocks.length) return blocks
  }

  // 2) Compatibilité: si on reçoit encore data + charts, on synthétise un JSON agrégé par "graphique"
  const defs = coerceChartsFromBody(charts)
  if (defs && Array.isArray(data) && data.length) {
    return defs.map((def, idx) => ({
      id: def.id || `chart${idx + 1}`,
      title: def.title || def.id || `Graphique ${idx + 1}`,
      data: summarizeSeries(data, def.metrics),
    }))
  }

  // 3) Dernier fallback: si on a seulement un tableau data, on le passe tel quel
  if (Array.isArray(data) && data.length) {
    return [{ id: 'dataset', title: 'Jeu de données', data }]
  }

  return []
}

async function ollamaChatOnce({ prompt, model, signal }) {
  const url = `${HOST}/api/chat`
  const r = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
    signal,
  })
  const raw = await r.text()
  if (!r.ok) {
    throw new Error(`ollama_chat_failed: ${r.status} ${r.statusText} — ${raw.slice(0, 200)}`)
  }
  return extractTextFromOllamaRaw(raw)
}

// Nouveau: génération de rapport avec chaînage (N résumés de blocs JSON + 1 synthèse) via POST
app.post('/api/report', async (req, res) => {
  const { context = '', locale = 'fr', tone = 'neutre', data = [], charts = null, jsons = null } = req.body || {}
  const title = 'Rapport de synthèse'
  const model = 'gpt-oss:20b'
  const t = withTimeout()

  try {
    const blocks = coerceJsonBlocks(jsons, data, charts)
    if (!blocks.length) {
      throw new Error('no_data_blocks_provided')
    }
    const summaries = []
    for (const block of blocks) {
      const prompt = `Tu es un analyste. Résume uniquement le bloc de données JSON ci-dessous, dans un style concis et orienté business.
 
Contexte métier : ${context || "(non fourni)"}
Langue de sortie : ${locale}
Ton attendu : ${tone}
Titre du bloc : ${block.title}
 
Données (au format JSON) :
${JSON.stringify(block.data)}
 
Consignes de synthèse :
- Résumé court : 8 à 12 lignes maximum.
- Mentionne les tendances générales, éventuelles ruptures, écarts notables entre catégories, extrêmes (min/max) et points d’attention.
- Ne propose aucune interprétation métier non présente explicitement dans le contexte.
- Si un indicateur n’est pas nommé dans le contexte, appelle-le simplement "metricA", "metricB", etc.
- Ne fais pas de synthèse multi-blocs : concentre-toi uniquement sur celui-ci.
 
Structure ta réponse en paragraphes courts ou en puces si pertinent.`
      const txt = await ollamaChatOnce({ prompt, model, signal: t.signal })
      summaries.push({ id: block.id, title: block.title, summary: txt.trim() })
    }

    const finalPrompt = `Tu es un analyste senior. À partir des résumés ci-dessous (issus de différents blocs JSON), rédige une synthèse transversale orientée business.
 
Contexte métier : ${context || "(non fourni)"}
Langue de sortie : ${locale}
Ton attendu : ${tone}
 
Structure obligatoire de ta réponse :
1. **Contexte** : rappelle brièvement les enjeux si le contexte est fourni, sinon précise que le contexte est absent.
2. **Faits marquants** : synthèse des messages clés extraits des différents résumés.
3. **Analyse croisée** : identifie les liens, corrélations ou ruptures entre indicateurs. Propose des hypothèses explicites (ex : "La hausse de metricA pourrait être liée à la baisse de metricB").
4. **Recommandations** : actions possibles ou points de vigilance à considérer.
 
Contraintes :
- Ne recopie pas les données brutes.
- Ne crée pas de notions métier non mentionnées dans le contexte.
- Si une information n'est pas présente ou ambigüe, indique-le explicitement ("aucune indication sur…", "corrélation possible mais non prouvée", etc.).
- Utilise des paragraphes courts, puces ou listes si utile à la clarté.
- Sois rigoureux, sans extrapolations excessives.

Résumés disponibles (union des résumés de blocs JSON) :
${summaries.map(s => `\n[${s.title}]\n${s.summary}`).join('\n')}`

    const finalTextRaw = await ollamaChatOnce({ prompt: finalPrompt, model, signal: t.signal })
    const finalText = cleanMarkdownForPdf(finalTextRaw).trim()

    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="rapport.pdf"')
    doc.pipe(res)
    doc.font('Times-Roman').fontSize(16).text(title, { align: 'center' })
    doc.moveDown()
    doc.fontSize(11).text(finalText, { align: 'left', lineGap: 4 })
    doc.end()
  } catch (e) {
    console.error('POST /api/report failed:', e)
    res.status(500).json({ error: 'report_generation_failed', message: e?.message || String(e) })
  } finally {
    t.clear()
  }
})

// GET /api/report : peut fonctionner avec ou sans JSON (pour intégration facile depuis d'autres plateformes)
// Si jsons_base64 est fourni, fait le chaînage (résumés multiples + synthèse)
// Sinon, fait un rapport simple basé uniquement sur le contexte
app.get('/api/report', async (req, res) => {
  const { context = '', locale = 'fr', tone = 'neutre', jsons_base64 = null } = req.query || {}
  const title = 'Rapport de synthèse'
  const model = 'gpt-oss:20b'
  const t = withTimeout()

  try {
    // Si jsons_base64 est fourni, on fait le chaînage (comme le POST)
    if (jsons_base64) {
      let jsons = null
      try {
        const decoded = Buffer.from(jsons_base64, 'base64').toString('utf-8')
        jsons = JSON.parse(decoded)
      } catch (e) {
        throw new Error(`Erreur de décodage jsons_base64: ${e.message}`)
      }

      const blocks = coerceJsonBlocks(jsons, [], null)
      if (!blocks.length) {
        throw new Error('no_data_blocks_provided')
      }

      const summaries = []
      for (const block of blocks) {
        const prompt = `Tu es un analyste. Résume uniquement le bloc de données JSON ci-dessous, dans un style concis et orienté business.
 
Contexte métier : ${context || "(non fourni)"}
Langue de sortie : ${locale}
Ton attendu : ${tone}
Titre du bloc : ${block.title}
 
Données (au format JSON) :
${JSON.stringify(block.data)}
 
Consignes de synthèse :
- Résumé court : 8 à 12 lignes maximum.
- Mentionne les tendances générales, éventuelles ruptures, écarts notables entre catégories, extrêmes (min/max) et points d'attention.
- Ne propose aucune interprétation métier non présente explicitement dans le contexte.
- Si un indicateur n'est pas nommé dans le contexte, appelle-le simplement "metricA", "metricB", etc.
- Ne fais pas de synthèse multi-blocs : concentre-toi uniquement sur celui-ci.
 
Structure ta réponse en paragraphes courts ou en puces si pertinent.`
        const txt = await ollamaChatOnce({ prompt, model, signal: t.signal })
        summaries.push({ id: block.id, title: block.title, summary: txt.trim() })
      }

      const finalPrompt = `Tu es un analyste senior. À partir des résumés ci-dessous (issus de différents blocs JSON), rédige une synthèse transversale orientée business.
 
Contexte métier : ${context || "(non fourni)"}
Langue de sortie : ${locale}
Ton attendu : ${tone}
 
Structure obligatoire de ta réponse :
1. **Contexte** : rappelle brièvement les enjeux si le contexte est fourni, sinon précise que le contexte est absent.
2. **Faits marquants** : synthèse des messages clés extraits des différents résumés.
3. **Analyse croisée** : identifie les liens, corrélations ou ruptures entre indicateurs. Propose des hypothèses explicites (ex : "La hausse de metricA pourrait être liée à la baisse de metricB").
4. **Recommandations** : actions possibles ou points de vigilance à considérer.
 
Contraintes :
- Ne recopie pas les données brutes.
- Ne crée pas de notions métier non mentionnées dans le contexte.
- Si une information n'est pas présente ou ambigüe, indique-le explicitement ("aucune indication sur…", "corrélation possible mais non prouvée", etc.).
- Utilise des paragraphes courts, puces ou listes si utile à la clarté.
- Sois rigoureux, sans extrapolations excessives.

Résumés disponibles (union des résumés de blocs JSON) :
${summaries.map(s => `\n[${s.title}]\n${s.summary}`).join('\n')}`

      const finalTextRaw = await ollamaChatOnce({ prompt: finalPrompt, model, signal: t.signal })
      const finalText = cleanMarkdownForPdf(finalTextRaw).trim()

      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="rapport.pdf"')
      doc.pipe(res)
      doc.font('Times-Roman').fontSize(16).text(title, { align: 'center' })
      doc.moveDown()
      doc.fontSize(11).text(finalText, { align: 'left', lineGap: 4 })
      doc.end()
      return
    }

    // Mode simple (sans JSON) : rapport basé uniquement sur le contexte
    const head = `Génère un rapport ${tone} en ${locale} intitulé "${title}".
- Structure en sections: Contexte, Faits marquants, Analyse, Recommandations.
- Garde un style concis (600-900 mots) avec puces là où utile.
- Harmonise le vocabulaire d'un rapport métier.
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
    const textRaw = extractTextFromOllamaRaw(raw)
    const text = cleanMarkdownForPdf(textRaw)

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
