import { useEffect, useState } from 'react'
import { fetchDashboard, resolveApproval } from '../api'

interface DashboardViewProps {
  onNavigate: (section: string) => void
  brandId?: string
}

export function DashboardView({ onNavigate, brandId }: DashboardViewProps) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetchDashboard(brandId)
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [brandId])

  if (loading && !data) {
    return (
      <div className="management-view">
        <div className="loading-state">Loading dashboard…</div>
      </div>
    )
  }

  const brandLabel = brandId === 'the-solver-agency' ? 'The Solver Agency' : 'Growthifyx'

  return (
    <div className="management-view dashboard-view">
      <div className="management-header">
        <div>
          <h2>OpenGrokBot Dashboard <span className="badge-verified" style={{ fontSize: '12px', verticalAlign: 'middle', marginLeft: '6px' }}>{brandLabel}</span></h2>
          <p className="management-subtitle">System status, AI providers, and live operations overview</p>
        </div>
        <button type="button" className="btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert-box error">{error}</div>}

      {data && (
        <>
          {/* Top KPI Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Active AI Provider</span>
              <div className="stat-value-wrap">
                <span className="stat-value">
                  {data.activeProvider === 'codex' ? 'OpenAI Codex' : 'Google Antigravity'}
                </span>
                <span className="badge-online">
                  {data.activeProvider === 'codex' ? 'ChatGPT Connected' : 'Google AI Pro Active'}
                </span>
              </div>
              <span className="stat-hint">
                {data.activeProvider === 'codex' ? 'Codex CLI · ChatGPT subscription' : 'Antigravity CLI (agy) · Native engine'}
              </span>
            </div>

            <div className="stat-card clickable" onClick={() => onNavigate('tasks')}>
              <span className="stat-label">Task Status</span>
              <div className="stat-value-wrap">
                <span className="stat-value">{data.tasks.running} Running</span>
                {data.tasks.queued > 0 && <span className="badge-pending">{data.tasks.queued} Queued</span>}
              </div>
              <span className="stat-hint">
                {data.tasks.completed} completed · {data.tasks.failed} failed
              </span>
            </div>

            <div className="stat-card clickable" onClick={() => onNavigate('leads')}>
              <span className="stat-label">Total Captured Leads</span>
              <div className="stat-value-wrap">
                <span className="stat-value">{data.leads.total}</span>
                <span className="badge-success">{data.leads.verified} Verified</span>
              </div>
              <span className="stat-hint">Deduplicated and persisted locally</span>
            </div>

            <div className="stat-card clickable" onClick={() => onNavigate('approvals')}>
              <span className="stat-label">Approval Center</span>
              <div className="stat-value-wrap">
                <span className="stat-value">{data.approvals.pendingCount}</span>
                {data.approvals.pendingCount > 0 ? (
                  <span className="badge-warning">Requires Approval</span>
                ) : (
                  <span className="badge-success">Safe Rules Active</span>
                )}
              </div>
              <span className="stat-hint">Routine inspection and tests auto-approved</span>
            </div>
          </div>

          {/* Quick Actions to Workspaces */}
          <div className="quick-chats-grid">
            <div className="workspace-card" onClick={() => onNavigate('workspace-lead-hunt')}>
              <div className="ws-card-head">
                <span className="ws-indicator ws-green" />
                <h3>LEAD HUNT</h3>
              </div>
              <p>Business research, lead discovery, and Excel-compatible CSV exports.</p>
              <span className="ws-action-link">Open Workspace →</span>
            </div>

            <div className="workspace-card" onClick={() => onNavigate('workspace-marketing')}>
              <div className="ws-card-head">
                <span className="ws-indicator ws-purple" />
                <h3>MARKETING</h3>
              </div>
              <p>Analyze business leads, draft outreach proposals, and prepare follow-ups.</p>
              <span className="ws-action-link">Open Workspace →</span>
            </div>
          </div>

          {/* Pending Approvals Section if any */}
          {data.approvals.pending.length > 0 && (
            <div className="dashboard-section">
              <div className="section-head">
                <h3>Pending Approvals ({data.approvals.pending.length})</h3>
                <button type="button" className="btn-link" onClick={() => onNavigate('approvals')}>
                  View All
                </button>
              </div>
              <div className="pending-list">
                {data.approvals.pending.map((req: any) => (
                  <div key={req.id} className="pending-item">
                    <div className="pending-info">
                      <span className="pending-tool">{req.tool}</span>
                      <span className="pending-summary">{req.summary}</span>
                    </div>
                    <div className="pending-actions">
                      <button
                        type="button"
                        className="btn-sm btn-success"
                        onClick={async () => {
                          await resolveApproval(req.id, true)
                          load()
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn-sm btn-danger"
                        onClick={async () => {
                          await resolveApproval(req.id, false)
                          load()
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Grid: Recent Activity & Files */}
          <div className="dashboard-columns">
            <div className="dashboard-col">
              <div className="section-head">
                <h3>Recent Output Files</h3>
                <button type="button" className="btn-link" onClick={() => onNavigate('outputs')}>
                  Open Manager
                </button>
              </div>
              <div className="file-list-compact">
                {data.outputs.recent.length === 0 ? (
                  <div className="empty-subtext">No output files generated yet.</div>
                ) : (
                  data.outputs.recent.map((f: any) => (
                    <div key={f.id} className="file-item-compact">
                      <span className="file-name">{f.name}</span>
                      <span className="file-meta">
                        {(f.size / 1024).toFixed(1)} KB · {f.category}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dashboard-col">
              <div className="section-head">
                <h3>Dedicated Browser Profiles</h3>
                <button type="button" className="btn-link" onClick={() => onNavigate('browser')}>
                  Browser Center
                </button>
              </div>
              <div className="browser-list-compact">
                {data.browsers.map((b: any) => (
                  <div key={b.id} className="browser-item-compact">
                    <div>
                      <strong>{b.name}</strong>
                      <div className="browser-desc">{b.purpose}</div>
                    </div>
                    <span className={`badge-status ${b.active ? 'status-active' : 'status-idle'}`}>
                      {b.active ? 'Running' : 'Idle'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
