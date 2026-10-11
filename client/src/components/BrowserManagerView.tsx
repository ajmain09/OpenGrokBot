import { useEffect, useState } from 'react'
import type { BrowserProfileInfo } from '../../../shared/types'
import { listBrowsers, openBrowserProfile, restartBrowserProfile } from '../api'

export function BrowserManagerView() {
  const [profiles, setProfiles] = useState<BrowserProfileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listBrowsers()
      setProfiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleOpen = async (id: 'lead-hunt' | 'marketing') => {
    try {
      const res = await openBrowserProfile(id)
      setNotice(res.message)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRestart = async (id: 'lead-hunt' | 'marketing') => {
    try {
      const res = await restartBrowserProfile(id)
      setNotice(res.message)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="management-view browser-manager-view">
      <div className="management-header">
        <div>
          <h2>Browser Manager</h2>
          <p className="management-subtitle">
            Dedicated Chrome profiles for automated research and WhatsApp Web workflows. Completely isolated from your personal Chrome profile.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {notice && (
        <div className="alert-box success">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="alert-close">✕</button>
        </div>
      )}
      {error && <div className="alert-box error">{error}</div>}

      <div className="card notice-banner">
        <h4>🔒 Security & Privacy Assurances:</h4>
        <p>
          • <strong>Profile 1 (Research):</strong> Used for automated Google searches, public business websites, and directory lookups.
          <br />
          • <strong>Profile 2 (Business):</strong> Used for WhatsApp Web and business outreach. Preserves your authenticated login session locally.
          <br />
          • Operates independently without stealing your keyboard, mouse, or personal browser windows.
        </p>
      </div>

      <div className="profiles-grid">
        {profiles.map((p) => (
          <div key={p.id} className="card browser-profile-card">
            <div className="profile-card-header">
              <div className="profile-title-group">
                <span className={`profile-dot ${p.active ? 'dot-active' : 'dot-idle'}`} />
                <div>
                  <h3>{p.name}</h3>
                  <span className="profile-id-code"><code>{p.id}</code></span>
                </div>
              </div>
              <span className={`status-pill ${p.active ? 'pill-verified' : 'pill-unverified'}`}>
                {p.active ? 'Running' : 'Idle'}
              </span>
            </div>

            <p className="profile-purpose">{p.purpose}</p>

            <div className="profile-meta-list">
              <div className="profile-meta-row">
                <span>📁 Storage Size:</span>
                <strong>{(p.sizeBytes / (1024 * 1024)).toFixed(1)} MB</strong>
              </div>
              <div className="profile-meta-row">
                <span>🕒 Last Activity:</span>
                <span>{new Date(p.lastActivity).toLocaleString()}</span>
              </div>
              <div className="profile-meta-row">
                <span>📍 Local Path:</span>
                <code className="path-code" title={p.path}>{p.path}</code>
              </div>
            </div>

            <div className="profile-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpen(p.id)}
              >
                Launch Profile in Chrome ↗
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleRestart(p.id)}
              >
                Restart / Reconnect
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
