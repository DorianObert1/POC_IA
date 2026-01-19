const STORAGE_KEY = 'reportsDirHandle'

export type PersistedDirHandle = FileSystemDirectoryHandle

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function chooseReportsDirectory(): Promise<PersistedDirHandle | null> {
  if (!supportsFileSystemAccess()) return null
  // @ts-expect-error: showDirectoryPicker exists in supported browsers
  const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ id: 'poc-ia-reports' })
  const ok = await verifyPermission(handle, true)
  if (!ok) return null
  await persistDirHandle(handle)
  return handle
}

export async function persistDirHandle(handle: PersistedDirHandle): Promise<void> {
  try {
    // Store via Indexed Storage (Origin Private File System) using localStorage with serialization via File System Access API
    // Most browsers allow storing the handle directly with structured clone in IndexedDB; we fallback to localStorage with no-op
    // Here we use localStorage token marker only; actual handle is kept via window object session when re-requested with "showDirectoryPicker".
    localStorage.setItem(STORAGE_KEY, '1')
    ;(window as any).__reportsDirHandle = handle
  } catch {
    // ignore
  }
}

export async function getPersistedDirHandle(): Promise<PersistedDirHandle | null> {
  const inMem = (window as any).__reportsDirHandle as PersistedDirHandle | undefined
  if (inMem) return inMem
  const marker = localStorage.getItem(STORAGE_KEY)
  if (!marker) return null
  // We cannot revive the handle from localStorage; ask user again with well-known id for better UX
  try {
    // Some browsers may support launchQueue or recentEntries; as a fallback we prompt selection again
    return null
  } catch {
    return null
  }
}

export async function verifyPermission(handle: FileSystemHandle, write: boolean): Promise<boolean> {
  if (!('queryPermission' in handle)) return false
  const opts = { mode: write ? 'readwrite' : 'read' }
  let perm = await (handle as any).queryPermission(opts)
  if (perm === 'granted') return true
  perm = await (handle as any).requestPermission(opts)
  return perm === 'granted'
}

export async function saveTextFile(dir: PersistedDirHandle, name: string, content: string): Promise<void> {
  const ok = await verifyPermission(dir, true)
  if (!ok) throw new Error('Permission refusée au dossier des rapports')
  const fileHandle = await dir.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function saveBlobFile(dir: PersistedDirHandle, name: string, blob: Blob): Promise<void> {
  const ok = await verifyPermission(dir, true)
  if (!ok) throw new Error('Permission refusée au dossier des rapports')
  const fileHandle = await dir.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

export async function listReportFiles(dir: PersistedDirHandle): Promise<{ name: string; handle: FileSystemFileHandle }[]> {
  const ok = await verifyPermission(dir, false)
  if (!ok) throw new Error('Permission lecture refusée')
  const result: { name: string; handle: FileSystemFileHandle }[] = []
  // @ts-expect-error: for-await supported on directory handle
  for await (const entry of dir.values()) {
    if (entry.kind === 'file') {
      result.push({ name: entry.name, handle: entry })
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name))
  return result
}

export async function deleteReportFile(dir: PersistedDirHandle, name: string): Promise<void> {
  const ok = await verifyPermission(dir, true)
  if (!ok) throw new Error('Permission refusée')
  await dir.removeEntry(name)
}

export function timestampFilename(base: string, ext: string): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  const safe = base.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-')
  return `${safe}-${y}${m}${day}-${hh}${mm}${ss}.${ext}`
}


