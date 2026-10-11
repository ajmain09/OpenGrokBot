import { useEffect, useState } from 'react'
import type { ApprovalHistoryItem } from '../../../shared/types'
import { clearApprovalHistory, fetchApprovalHistory, listTasks } from '../api'

export function ActivityLogsView() {
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'auto-approved' | 'approved' | 'rejected' | 'tasks'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [hist, taskList] = await Promise.all([
        fetchApprovalHistory(),
        listTasks().catch(() => []),
      ])
      setHistory(hist)
      setTasks(taskList)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [])

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear the activity audit history?')) return
    try {
      await clearApprovalHistory()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // Combine items into unified timeline
  const timelineItems: Array<{
    id: string
    type: 'approval' | 'task'
    status: string
    title: string
    subtitle: string
    detail?: string
    timestamp: number
  }> = []

  for (const item of history) {
    timelineItems.push({
      id: item.id,
      type: 'approval',
      status: item.status,
      title: item.tool,
      subtitle: item.summary,
      detail: item.autoRule ? `Rule: ${item.autoRule}` : 'User manual decision',
      timestamp: item.timestamp,
    })
  }

  for (const t of tasks) {
    timelineItems.push({
      id: `task-${t.id}`,
      type: 'task',
      status: t.status,
      title: `Task [${t.workspace === 'workspace-marketing' ? 'MARKETING' : 'LEAD HUNT'}]`,
      subtitle: t.title || t.prompt,
      detail: t.resultSummary || t.error || (t.progress ? `Progress: ${t.progress}` : undefined),
      timestamp: t.createdAt,
    })
  }

  timelineItems.sort((a, b) => b.timestamp - a.timestamp)

  const filtered = timelineItems.filter((item) => {
    if (filter === 'auto-approved' && item.status !== 'auto-approved') return false
    if (filter === 'approved' && item.status !== 'approved') return false
    if (filter === 'rejected' && item.status !== 'rejected') return false
    if (filter === 'tasks' && item.type !== 'task') return false

    if (search.trim()) {
      const q = search.toLowerCase()
      const haystack = `${item.title} ${item.subtitle} ${item.detail || ''} ${item.status}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return (
    <div className="management-view activity-logs-view">
      <div className="management-header">
        <div>
          <h2>Activity Logs</h2>
          <p className="management-subtitle">
            Comprehensive audit trail of background agent operations, tool executions, and security reviews.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Clear History
          </button>
        </div>
      </div>

      {error && <div className="alert-box error">{error}</div>}

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Filter logs by tool name, summary, or details…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="tab-bar-inline">
          <button
            type="button"
            className={`tab-btn-sm ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Events ({timelineItems.length})
          </button>
          <button
            type="button"
            className={`tab-btn-sm ${filter === 'auto-approved' ? 'active' : ''}`}
            onClick={() => setFilter('auto-approved')}
          >
            Auto-Approved ({timelineItems.filter((i) => i.status === 'auto-approved').length})
          </button>
          <button
            type="button"
            className={`tab-btn-sm ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            User Approved ({timelineItems.filter((i) => i.status === 'approved').length})
          </button>
          <button
            type="button"
            className={`tab-btn-sm ${filter === 'tasks' ? 'active' : ''}`}
            onClick={() => setFilter('tasks')}
          >
            Task Queue ({timelineItems.filter((i) => i.type === 'task').length})
          </button>
        </div>
      </div>

      {/* Timeline Table */}
      <div className="card table-container">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No activity logs found matching the filter.</p>
            <span className="empty-subtext">Events and background operations will automatically populate as tasks run.</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>Timestamp</th>
                <th style={{ width: '130px' }}>Type / Tool</th>
                <th style={{ width: '120px' }}>Status</th>
                <th>Operation / Summary</th>
                <th>Rule / Execution Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ whiteSpace: 'nowrap' }} className="text-muted">
                    {new Date(item.timestamp).toLocaleTimeString()} · {new Date(item.timestamp).toLocaleDateString()}
                  </td>
                  <td>
                    <code>{item.title}</code>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        item.status === 'auto-approved' || item.status === 'completed'
                          ? 'pill-verified'
                          : item.status === 'approved' || item.status === 'running'
                          ? 'pill-partially-verified'
                          : item.status === 'failed' || item.status === 'rejected'
                          ? 'pill-unverified'
                          : ''
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <strong>{item.subtitle}</strong>
                  </td>
                  <td className="text-muted">
                    {item.detail || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

