import { useEffect, useState } from 'react'
import type { BrowserProfileInfo } from '../../../shared/types'
import {
  captureScreenshot,
  fetchComputerStatus,
  listBrowsers,
  openBrowserProfile,
  restartBrowserProfile,
} from '../api'

interface BrowserManagerViewProps {
  brandId?: string
}

export function BrowserManagerView({ brandId = 'growthifyx' }: BrowserManagerViewProps) {
  const [profiles, setProfiles] = useState<BrowserProfileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Computer status & screenshot state
  const [computerStatus, setComputerStatus] = useState<{
    platform: string
    arch: string
    nodeVersion: string
    windowsAutomationSupported: boolean
    powershellAvailable: boolean
    timestamp: number
  } | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [lastScreenshot, setLastScreenshot] = useState<{ path: string; filename: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [browsersData, compData] = await Promise.all([
        listBrowsers(),
        fetchComputerStatus().catch(() => null),
      ])
      setProfiles(browsersData)
      if (compData) setComputerStatus(compData)
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

  const handleCaptureScreenshot = async () => {
    setCapturing(true)
    setError(null)
    try {
      const res = await captureScreenshot(brandId)
      if (res.ok) {
        setLastScreenshot({ path: res.path, filename: res.filename })
        setNotice(`Screenshot captured and saved to ${res.filename}!`)
      } else {
        setError('Failed to capture screenshot')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="management-view browser-manager-view">
      <div className="management-header">
        <div>
          <h2>Browser & Computer Automation Control</h2>
          <p className="management-subtitle">
            Manage persistent Chrome browser profiles and native Windows computer automation capabilities.
          </p>
        </div>
        <div className="btn-group">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCaptureScreenshot}
            disabled={capturing}
          >
            {capturing ? 'Capturing…' : '📷 Take Screen Snapshot'}
          </button>
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert-box success">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="alert-close">
            ✕
          </button>
        </div>
      )}
      {error && <div className="alert-box error">{error}</div>}

      {/* Screenshot result preview banner */}
      {lastScreenshot && (
        <div className="card screenshot-result-banner">
          <div className="screenshot-info">
            <span className="screenshot-badge">📸 New Screenshot Captured</span>
            <code className="screenshot-path" title={lastScreenshot.path}>
              {lastScreenshot.path}
            </code>
          </div>
          <p className="screenshot-hint">
            Saved inside Brand Output hierarchy under <code>Outputs/{brandId}/Screenshots/</code>
          </p>
        </div>
      )}

      {/* SECTION 1: Windows Computer Automation Status */}
      <div className="card computer-status-card">
        <div className="section-head">
          <h3>💻 Windows Computer Control System</h3>
          <span className="status-pill pill-verified">● Operating System Connected</span>
        </div>
        <p className="computer-desc">
          Authorized AI agents can inspect desktop state via native PowerShell GDI+, interact with Windows apps, manage files, and automate repetitive tasks.
        </p>

        <div className="system-metrics-grid">
          <div className="metric-box">
            <span className="metric-lbl">OS Platform</span>
            <strong className="metric-val">{computerStatus?.platform === 'win32' ? 'Windows OS' : computerStatus?.platform || 'Windows'}</strong>
          </div>
          <div className="metric-box">
            <span className="metric-lbl">Architecture</span>
            <strong className="metric-val">{computerStatus?.arch || 'x64'}</strong>
          </div>
          <div className="metric-box">
            <span className="metric-lbl">PowerShell Engine</span>
            <strong className="metric-val text-success">
              {computerStatus?.powershellAvailable ? 'Available (.NET GDI+)' : 'Checking…'}
            </strong>
          </div>
          <div className="metric-box">
            <span className="metric-lbl">Automation Engine</span>
            <strong className="metric-val text-success">
              {computerStatus?.windowsAutomationSupported ? 'Active & Ready' : 'Enabled'}
            </strong>
          </div>
        </div>

        <div className="automation-safeguards">
          <h4>🔒 Safeguards & Security Rules:</h4>
          <ul>
            <li>• Safe operations (reading windows, screen inspection, lead gathering) execute automatically.</li>
            <li>• Destructive commands, system modifications, or payments always require explicit confirmation.</li>
            <li>• Browser automation does not steal focus, move your physical cursor wildly, or interfere with personal work.</li>
          </ul>
        </div>
      </div>

      {/* SECTION 2: Dedicated Chrome Profiles */}
      <div className="section-head-standalone">
        <h3>🌐 Dedicated Chrome Browser Profiles</h3>
        <p className="section-subtitle">
          Completely isolated from your personal Chrome profile. Dedicated to business lead research and WhatsApp Web.
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
                  <span className="profile-id-code">
                    <code>{p.id}</code>
                  </span>
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
                <code className="path-code" title={p.path}>
                  {p.path}
                </code>
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
