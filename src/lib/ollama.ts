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
  const res = await fetch(`${base}/api/tags`).catch(() => undefined)
  if (!res?.ok) return []
  const data = await res.json().catch(() => ({}))
  const models = Array.isArray(data?.models) ? data.models : []
  return models.map((m: any) => m.name).filter((n: any) => typeof n === 'string')
}
