import express from 'express'
import cors from 'cors'

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

app.listen(PORT, () => {
  console.log(`Proxy Ollama server listening on http://localhost:${PORT}`)
})
