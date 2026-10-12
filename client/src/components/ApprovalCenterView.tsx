import { useEffect, useState } from 'react'
import type { ApprovalHistoryItem, ApprovalRequest, AuditLogEntry, OwnerPermissionsConfig, PermissionLevel } from '../../../shared/types'
import {
  clearApprovalHistory,
  clearAuditLogs,
  fetchApprovalHistory,
  fetchAuditLogs,
  fetchPermissions,
  fetchState,
  resolveApproval,
  updatePermissions,
} from '../api'

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  'browser.navigate': {
    label: 'Browser Navigation & Research',
    description: 'Allow bots to visit websites and extract publicly available leads and data.',
  },
  'file.write': {
    label: 'Safe File & Report Writing',
    description: 'Allow writing CSV exports, proposals, and logs to approved output directories.',
  },
  'file.delete': {
    label: 'File & Database Deletion',
    description: 'Require owner approval before deleting any files or records from disk.',
  },
  'terminal.command': {
    label: 'Terminal & Command Execution',
    description: 'Allow safe development, verification, and inspection shell commands.',
  },
  'windows.control': {
    label: 'Windows Desktop Automation',
    description: 'Allow screen capture and desktop application inspection on Windows.',
  },
  'messaging.outbound': {
    label: 'Outbound Messaging & WhatsApp',
    description: 'External customer communication (Overridden when brand auto-messaging is enabled).',
  },
  'finance.payment': {
    label: 'Financial Transactions & Payments',
    description: 'Purchases, checkouts, and financial transactions strictly require owner confirmation.',
  },
  'credential.access': {
    label: 'Secrets & Credential Lookups',
    description: 'Access to .env files, private keys, and passwords strictly requires owner approval.',
  },
  'security.config': {
    label: 'Security & Permission Modifying',
    description: 'Bots are strictly blocked from self-modifying security rules.',
  },
}

export function ApprovalCenterView() {
  const [activeTab, setActiveTab] = useState<'pending' | 'permissions' | 'audit'>('pending')
  const [pending, setPending] = useState<ApprovalRequest[]>([])
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [permissionsConfig, setPermissionsConfig] = useState<OwnerPermissionsConfig | null>(null)
  const [permDraft, setPermDraft] = useState<Record<string, PermissionLevel>>({})
  const [auditFilter, setAuditFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [state, hist, perms, auditData] = await Promise.all([
        fetchState(),
        fetchApprovalHistory(),
        fetchPermissions().catch(() => null),
        fetchAuditLogs().catch(() => ({ logs: [] })),
      ])
      setPending(state.approvals)
      setHistory(hist)
      if (perms) {
        setPermissionsConfig(perms)
        setPermDraft(perms.defaults || {})
      }
      setAuditLogs(auditData.logs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      // Background poll for pending approvals and state
      fetchState().then((s) => setPending(s.approvals)).catch(() => {})
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const handleResolve = async (id: string, allow: boolean, always = false) => {
    try {
      await resolveApproval(id, allow, always)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSavePermissions = async () => {
    setSavingPolicy(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await updatePermissions(permDraft)
      setPermissionsConfig(updated)
      setPermDraft(updated.defaults)
      setNotice('Owner Permission Policy successfully saved and applied!')
      setTimeout(() => setNotice(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingPolicy(false)
    }
  }

  const filteredAuditLogs = auditLogs.filter((entry) => {
    if (auditFilter === 'all') return true
    return entry.decision === auditFilter
  })

  return (
    <div className="management-view approval-center-view">
      <div className="management-header">
        <div>
          <h2>Approval Center & Security Engine</h2>
          <p className="management-subtitle">
            Owner-controlled permission matrix, pending tool confirmations, and immutable audit trail.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
          {activeTab === 'pending' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                if (window.confirm('Clear resolved approval history?')) {
                  await clearApprovalHistory()
                  await load()
                }
              }}
            >
              Clear History
            </button>
          )}
          {activeTab === 'audit' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                if (window.confirm('Clear all stored audit logs?')) {
                  await clearAuditLogs()
                  await load()
                }
              }}
            >
              Clear Audit Log
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert-box error">{error}</div>}
      {notice && <div className="alert-box success">{notice}</div>}

      {/* Tabs navigation */}
      <div className="tab-bar" style={{ marginBottom: '16px' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approvals ({pending.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('permissions')}
        >
          Owner Permissions Matrix
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Durable Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {activeTab === 'pending' && (
        <>
          <div className="card notice-banner" style={{ marginBottom: '16px' }}>
            <h4>🛡️ Active Safeguard Policy:</h4>
            <p>
              • <strong>Routine Operations:</strong> File reads, search queries, and outputs are automatically permitted without interruptions.
              <br />
              • <strong>Sensitive Operations:</strong> Irreversible file deletions, credentials lookups, and unverified outbound messaging require your one-click approval below.
            </p>
          </div>

          <div className="card section-card">
            <div className="section-head">
              <h3>Pending Approvals ({pending.length})</h3>
            </div>
            {pending.length === 0 ? (
              <div className="empty-state">
                <p>No operations currently waiting for approval.</p>
                <span className="empty-subtext">All active bots and tasks are executing within approved permission limits.</span>
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

          <div className="card section-card" style={{ marginTop: '16px' }}>
            <div className="section-head">
              <h3>Recent Approval History ({history.length})</h3>
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
                      <th>Tool</th>
                      <th>Summary</th>
                      <th>Decision</th>
                      <th>Reason / Rule</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 50).map((item) => (
                      <tr key={item.id}>
                        <td><code>{item.tool}</code></td>
                        <td>{item.summary}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              item.status === 'auto-approved'
                                ? 'pill-verified'
                                : item.status === 'approved'
                                ? 'pill-verified'
                                : 'pill-unverified'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{item.autoRule || 'Manual Owner Decision'}</td>
                        <td>{new Date(item.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: OWNER PERMISSION MATRIX */}
      {activeTab === 'permissions' && (
        <div className="card section-card">
          <div className="section-head">
            <div>
              <h3>Owner Permission Matrix (Allow / Ask / Deny)</h3>
              <p className="section-desc">
                Configure execution boundaries for all bots. Only you (the owner) can modify these rules; bots cannot modify their own permissions.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSavePermissions}
              disabled={savingPolicy}
            >
              {savingPolicy ? 'Saving…' : 'Save Permission Policy'}
            </button>
          </div>

          <div className="permissions-matrix-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {Object.entries(PERMISSION_LABELS).map(([catKey, info]) => {
              const currentVal: PermissionLevel = permDraft[catKey] || 'ask'
              return (
                <div
                  key={catKey}
                  className="permission-row-card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--card-bg, #fff)',
                  }}
                >
                  <div style={{ maxWidth: '65%' }}>
                    <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text)' }}>
                      {info.label}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {info.description}
                    </span>
                  </div>

                  <div className="permission-level-selector" style={{ display: 'flex', gap: '6px' }}>
                    {(['allow', 'ask', 'deny'] as PermissionLevel[]).map((level) => {
                      const isSelected = currentVal === level
                      let btnBg = 'var(--bg-subtle, #f0f0f0)'
                      let btnColor = 'var(--text)'
                      if (isSelected) {
                        if (level === 'allow') {
                          btnBg = '#18836B'
                          btnColor = '#fff'
                        } else if (level === 'ask') {
                          btnBg = '#d97706'
                          btnColor = '#fff'
                        } else {
                          btnBg = '#dc2626'
                          btnColor = '#fff'
                        }
                      }

                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setPermDraft((prev) => ({ ...prev, [catKey]: level }))}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: isSelected ? 'none' : '1px solid var(--border)',
                            backgroundColor: btnBg,
                            color: btnColor,
                            fontWeight: isSelected ? 600 : 400,
                            cursor: 'pointer',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {level}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSavePermissions}
              disabled={savingPolicy}
            >
              {savingPolicy ? 'Saving…' : 'Save Permission Policy'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: DURABLE AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="card section-card">
          <div className="section-head">
            <div>
              <h3>Durable Audit Trail (Persisted in data/audit-log.json)</h3>
              <p className="section-desc">
                All tool executions, security policy decisions, and approvals are recorded with automatic token scrubbing.
              </p>
            </div>
            <div className="filter-chips-row" style={{ display: 'flex', gap: '6px' }}>
              {['all', 'allowed', 'approved', 'rejected', 'denied'].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn-sm ${auditFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAuditFilter(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div className="empty-state">
              <p>No audit log entries matching &ldquo;{auditFilter}&rdquo;.</p>
            </div>
          ) : (
            <div className="table-container" style={{ marginTop: '12px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Decision</th>
                    <th>Category</th>
                    <th>Tool</th>
                    <th>Action Summary</th>
                    <th>Reason / Result</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => {
                    const badgeClass =
                      log.decision === 'allowed' || log.decision === 'approved'
                        ? 'pill-verified'
                        : log.decision === 'denied'
                        ? 'pill-unverified'
                        : 'pill-partially-verified'

                    return (
                      <tr key={log.id}>
                        <td>
                          <span className={`status-pill ${badgeClass}`}>
                            {log.decision.toUpperCase()}
                          </span>
                        </td>
                        <td><code>{log.category}</code></td>
                        <td><strong>{log.tool}</strong></td>
                        <td>{log.actionSummary}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {log.reason || log.result || log.error || '—'}
                        </td>
                        <td>{new Date(log.timestamp).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
