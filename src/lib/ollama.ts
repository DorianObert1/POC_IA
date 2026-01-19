import { Ollama as OllamaClient } from 'ollama/browser'

// Le token ne doit plus être exposé côté client; il est injecté côté serveur proxy via OLLAMA_TOKEN
const base = (import.meta.env.VITE_PROXY_BASE as string | undefined) || 'http://localhost:8787'
const host = `${base}` // le SDK ajoute /api/*

const ollama = new OllamaClient({ host })

export async function callOllama(req: { model: string; prompt: string; stream?: boolean }) {
  const res = await ollama.generate({ model: req.model, prompt: req.prompt, stream: false })
  // @ts-ignore
  if (typeof res?.response === 'string') return res.response
  // @ts-ignore
  if (typeof res?.message?.content === 'string') return res.message.content
  return JSON.stringify(res)
}

export async function callOllamaChat(prompt: string, model: string) {
  const res = await ollama.chat({ model, messages: [{ role: 'user', content: prompt }], stream: false })
  // @ts-ignore
  if (typeof res?.message?.content === 'string') return res.message.content
  // @ts-ignore
  if (typeof res?.response === 'string') return res.response
  return JSON.stringify(res)
}

export type PingInfo = { ok: boolean; endpoint: string; status?: number; statusText?: string; body?: string; modelsCount?: number; message?: string }

export async function pingOllama(): Promise<PingInfo> {
  try {
    const res = await fetch(`${base}/api/version`)
    const ct = res.headers.get('content-type') || ''
    const body = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text()
    return { ok: res.ok, endpoint: `${base}/api/version`, status: res.status, statusText: res.statusText, body }
  } catch (e: any) {
    return { ok: false, endpoint: `${base}/api/version`, message: e?.message || String(e) }
  }
}

export async function listModels(): Promise<string[]> {
  let res: Response
  try {
    res = await fetch(`${base}/api/tags`)
  } catch (e: any) {
    throw new Error(`Connexion impossible vers ${base}/api/tags : ${e?.message || e}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Liste des modèles: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`)
  }
  const data = await res.json().catch(() => ({}))
  const models = Array.isArray((data as any)?.models) ? (data as any).models : []
  return models.map((m: any) => m.name).filter((n: any) => typeof n === 'string')
}

// Appel du service backend qui génère le rapport + PDF (modèle gpt-oss:20b côté serveur)
// Nouveau contrat: l'endpoint peut recevoir un ou plusieurs blocs JSON à analyser.
export async function fetchReportPdf(params: {
  context?: string
  locale?: string
  tone?: string
  jsons?: unknown[]
  // Compat legacy: on propage encore data/charts mais le serveur privilégie jsons s'il est fourni.
  data?: unknown
  charts?: unknown
}): Promise<Blob> {
  // Nouveau flux: POST JSON avec les données filtrées pour permettre un chaînage de prompts côté serveur.
  // Fallback implicite: si le serveur ne supporte pas encore le POST, il renverra une erreur explicite.
  const url = `${base}/api/report`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: params.context || '',
        locale: params.locale || 'fr',
        tone: params.tone || 'neutre',
        jsons: params.jsons,
        data: params.data,
        charts: params.charts,
      }),
    })
  } catch (e: any) {
    throw new Error(`Connexion impossible vers ${url} : ${e?.message || e}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Génération du rapport: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`)
  }
  return await res.blob()
}
