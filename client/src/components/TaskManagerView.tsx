import { useEffect, useState } from 'react'
import { cancelTask, clearFinishedTasks, createTask, deleteTask, listTasks, retryTask } from '../api'

interface TaskManagerViewProps {
  onNavigateToApprovals?: () => void
}

export function TaskManagerView({ onNavigateToApprovals }: TaskManagerViewProps) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'running' | 'queued' | 'completed' | 'failed' | 'waiting-approval' | 'cancelled'>('all')

  // Create Task Form State
  const [title, setTitle] = useState('')
  const [workspace, setWorkspace] = useState<'workspace-lead-hunt' | 'workspace-marketing'>('workspace-lead-hunt')
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    listTasks()
      .then((data) => {
        setTasks(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createTask({
        title: title.trim() || 'Custom Task',
        workspace,
        prompt: prompt.trim(),
      })
      setTitle('')
      setPrompt('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = tasks.filter((t) => {
    if (filter === 'all') return true
    return t.status === filter
  })

  return (
    <div className="management-view task-manager-view">
      <div className="management-header">
        <div>
          <h2>Task Manager</h2>
          <p className="management-subtitle">
            Manage long-running agent tasks and background automation. Results are automatically saved.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-secondary" onClick={load}>
            Refresh
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await clearFinishedTasks()
              load()
            }}
          >
            Clear Completed
          </button>
        </div>
      </div>

      {error && <div className="alert-box error">{error}</div>}

      {/* New Task Creation Form */}
      <div className="card new-task-card">
        <h3>Create New Background Task</h3>
        <form onSubmit={handleCreate} className="task-form">
          <div className="form-row">
            <input
              type="text"
              placeholder="Task title (e.g. Collect 20 café contacts in Gulshan)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="task-title-input"
            />
            <select
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value as any)}
              className="task-ws-select"
            >
              <option value="workspace-lead-hunt">LEAD HUNT (Research & Leads)</option>
              <option value="workspace-marketing">MARKETING (Outreach & Messaging)</option>
            </select>
          </div>
          <textarea
            rows={3}
            placeholder="Enter prompt instructions for the agent (in natural Bangla or English, e.g. 'গুলশান এলাকার ২০টি ক্যাফে ও রেস্টুরেন্টের ফোন নম্বর ও ফেসবুক পেজ সংগ্রহ করো')…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="task-prompt-input"
            required
          />
          <div className="form-footer">
            <span className="task-hint">
              💡 Runs in background without interfering with your personal keyboard or mouse.
            </span>
            <button type="submit" className="btn-primary" disabled={submitting || !prompt.trim()}>
              {submitting ? 'Starting…' : 'Start Task'}
            </button>
          </div>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({tasks.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${filter === 'running' ? 'active' : ''}`}
          onClick={() => setFilter('running')}
        >
          Running ({tasks.filter((t) => t.status === 'running').length})
        </button>
        <button
          type="button"
          className={`tab-btn ${filter === 'queued' ? 'active' : ''}`}
          onClick={() => setFilter('queued')}
        >
          Queued ({tasks.filter((t) => t.status === 'queued').length})
        </button>
        <button
          type="button"
          className={`tab-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({tasks.filter((t) => t.status === 'completed').length})
        </button>
        <button
          type="button"
          className={`tab-btn ${filter === 'waiting-approval' ? 'active' : ''}`}
          onClick={() => setFilter('waiting-approval')}
        >
          Waiting Approval ({tasks.filter((t) => t.status === 'waiting-approval').length})
        </button>
        <button
          type="button"
          className={`tab-btn ${filter === 'failed' ? 'active' : ''}`}
          onClick={() => setFilter('failed')}
        >
          Failed ({tasks.filter((t) => t.status === 'failed').length})
        </button>
        <button
          type="button"
          className={`tab-btn ${filter === 'cancelled' ? 'active' : ''}`}
          onClick={() => setFilter('cancelled')}
        >
          Cancelled ({tasks.filter((t) => t.status === 'cancelled').length})
        </button>
      </div>

      {/* Task Cards List */}
      <div className="task-list">
        {filtered.length === 0 ? (
          <div className="card empty-state">
            <p>No tasks found matching current filter.</p>
          </div>
        ) : (
          filtered.map((task) => (
            <div key={task.id} className={`card task-card status-${task.status}`}>
              <div className="task-card-header">
                <div className="task-meta-left">
                  <span className={`status-badge badge-${task.status}`}>
                    {task.status === 'waiting-approval' ? 'WAITING APPROVAL' : task.status.toUpperCase()}
                  </span>
                  <span className="task-workspace-tag">
                    {task.workspace === 'workspace-marketing' ? 'MARKETING' : 'LEAD HUNT'}
                  </span>
                  <span className="task-date">{new Date(task.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="task-actions">
                  {(task.status === 'running' || task.status === 'queued' || task.status === 'waiting-approval') && (
                    <button
                      type="button"
                      className="btn-sm btn-danger"
                      onClick={async () => {
                        await cancelTask(task.id)
                        load()
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  {(task.status === 'failed' || task.status === 'cancelled') && (
                    <button
                      type="button"
                      className="btn-sm btn-secondary"
                      onClick={async () => {
                        await retryTask(task.id)
                        load()
                      }}
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-icon"
                    title="Delete"
                    onClick={async () => {
                      await deleteTask(task.id)
                      load()
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>

              <h4 className="task-card-title">{task.title}</h4>
              <p className="task-card-prompt">{task.prompt}</p>

              {task.progress && (
                <div className="task-progress-box">
                  <span className="spinner-sm" /> {task.progress}
                </div>
              )}

              {task.status === 'waiting-approval' && onNavigateToApprovals && (
                <div className="alert-box warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🛡️ This task requires approval for an outbound action.</span>
                  <button type="button" className="btn-sm btn-primary" onClick={onNavigateToApprovals}>
                    Review Approval ↗
                  </button>
                </div>
              )}

              {task.error && <div className="alert-box error task-error">{task.error}</div>}

              {task.resultSummary && (
                <div className="alert-box success task-result">{task.resultSummary}</div>
              )}

              {/* Logs */}
              {task.logs && task.logs.length > 0 && (
                <details className="task-logs-details">
                  <summary>Activity & Execution Logs ({task.logs.length})</summary>
                  <pre className="task-logs-pre">{task.logs.join('\n')}</pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
