import { useEffect, useState } from 'react'
import { chooseReportsDirectory, getPersistedDirHandle, listReportFiles, persistDirHandle, deleteReportFile } from '../lib/files'
import { Link } from 'react-router-dom'

export default function ReportsPage() {
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null)
  const [files, setFiles] = useState<{ name: string; handle: FileSystemFileHandle }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const h = await getPersistedDirHandle()
      if (h) setDir(h)
    })()
  }, [])

  async function refresh() {
    if (!dir) return
    setLoading(true)
    setError(null)
    try {
      const list = await listReportFiles(dir)
      setFiles(list)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [dir])

  return (
    <div className="container" style={{ padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Rapports générés</h2>
        <Link to="/">← Retour</Link>
      </header>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={async () => {
          const h = await chooseReportsDirectory()
          if (h) { setDir(h); await persistDirHandle(h) }
        }}>{dir ? 'Changer de dossier' : 'Choisir un dossier'}</button>
        <button onClick={refresh} disabled={!dir || loading}>{loading ? 'Chargement…' : 'Rafraîchir'}</button>
        {error && <span className="error">{error}</span>}
      </div>
      {!dir && <p>Sélectionnez un dossier de rapports pour afficher la liste.</p>}
      {dir && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {files.map(({ name, handle }) => (
            <li key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #eee', borderRadius: 8 }}>
              <span>{name}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => {
                  const file = await handle.getFile()
                  const url = URL.createObjectURL(file)
                  window.open(url, '_blank')
                }}>Ouvrir</button>
                <button onClick={async () => {
                  const file = await handle.getFile()
                  const url = URL.createObjectURL(file)
                  const win = window.open(url, '_blank')
                  if (win) {
                    const tryPrint = () => { try { win.focus(); win.print() } catch {} }
                    const interval = setInterval(tryPrint, 400)
                    setTimeout(() => { clearInterval(interval) }, 5000)
                  }
                  setTimeout(() => URL.revokeObjectURL(url), 8000)
                }}>Imprimer</button>
                <button onClick={async () => {
                  if (!dir) return
                  await deleteReportFile(dir, name)
                  await refresh()
                }} style={{ color: '#a00' }}>Supprimer</button>
              </span>
            </li>
          ))}
          {files.length === 0 && <li>Aucun fichier trouvé dans ce dossier.</li>}
        </ul>
      )}
    </div>
  )
}


