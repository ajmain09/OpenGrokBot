import { useEffect, useState } from 'react'
import type { ApprovalHistoryItem, ApprovalRequest } from '../../../shared/types'
import { clearApprovalHistory, fetchApprovalHistory, fetchState, resolveApproval } from '../api'

export function ApprovalCenterView() {
  const [pending, setPending] = useState<ApprovalRequest[]>([])
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [state, hist] = await Promise.all([fetchState(), fetchApprovalHistory()])
      setPending(state.approvals)
      setHistory(hist)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [])

  const handleResolve = async (id: string, allow: boolean, always = false) => {
    try {
      await resolveApproval(id, allow, always)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="management-view approval-center-view">
      <div className="management-header">
        <div>
          <h2>Approval Center</h2>
          <p className="management-subtitle">
            Safe workspace file reads, web research, and verification commands are auto-approved. Outbound messages, file deletions, and secret access require explicit owner consent.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await clearApprovalHistory()
              load()
            }}
          >
            Clear History
          </button>
        </div>
      </div>

      {error && <div className="alert-box error">{error}</div>}

      {/* Safety Policy Box */}
      <div className="card notice-banner">
        <h4>🛡️ Auto-Approval & Security Policy (Turbo Mode):</h4>
        <p>
          • <strong>Auto-Approved (Safe Commands):</strong> Workspace file inspection (<code>Read</code>, <code>Glob</code>, <code>Grep</code>), web research (<code>WebSearch</code>), test & build verification (<code>npm run typecheck</code>, <code>npm test</code>, <code>npm run build</code>, <code>git status</code>), and outputs persistence.
          <br />
          • <strong>Requires Owner Approval:</strong> Permanent file deletions, credential/secret access, and external messaging.
        </p>
      </div>

      {/* Pending Approvals */}
      <div className="card section-card">
        <div className="section-head">
          <h3>Pending Approvals ({pending.length})</h3>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state">
            <p>No operations currently require approval.</p>
            <span className="empty-subtext">All safe background operations and routine checks are proceeding automatically.</span>
          </div>
        ) : (
          <div className="pending-cards-list">
            {pending.map((req) => (
              <div key={req.id} className="approval-req-card">
                <div className="req-header">
                  <span className="badge-scope scope-marketing">{req.tool}</span>
                  <span className="req-time">{new Date(req.createdAt).toLocaleTimeString()}</span>
                </div>
                <h4 className="req-summary">{req.summary}</h4>
                <div className="req-inputs">
                  <pre>{JSON.stringify(req.input, null, 2)}</pre>
                </div>
                <div className="req-actions">
                  <button
                    type="button"
                    className="btn-sm btn-success"
                    onClick={() => handleResolve(req.id, true, false)}
                  >
                    Allow Once
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-primary"
                    onClick={() => handleResolve(req.id, true, true)}
                  >
                    Always Allow Tool
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-danger"
                    onClick={() => handleResolve(req.id, false, false)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval History */}
      <div className="card section-card">
        <div className="section-head">
          <h3>Approval History & Audit Trail ({history.length})</h3>
        </div>
        {history.length === 0 ? (
          <div className="empty-state">
            <p>No approval history recorded yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tool / Action</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Rule / Decision Reason</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.tool}</code></td>
                    <td>{item.summary}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.status === 'auto-approved'
                            ? 'pill-verified'
                            : item.status === 'approved'
                            ? 'pill-partially-verified'
                            : 'pill-unverified'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{item.autoRule || 'Manual user decision'}</td>
                    <td>{new Date(item.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
