import { useEffect, useState } from 'react'
import type { Agent, Brand, Workflow } from '../../../shared/types'
import { DEFAULT_BRANDS } from '../../../shared/types'
import { createWorkflow, deleteWorkflow, fetchWorkflows, runWorkflow } from '../api'

interface WorkflowsViewProps {
  agents?: Agent[]
  brands?: Brand[]
  activeBrand: string
  onNavigateToTasks?: () => void
  onNavigate?: (id: string) => void
}

export function WorkflowsView({ agents, brands, activeBrand, onNavigateToTasks, onNavigate }: WorkflowsViewProps) {
  const agentList = agents && agents.length > 0 ? agents : []
  const brandList = brands && brands.length > 0 ? brands : DEFAULT_BRANDS
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  // New Workflow form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newBrandId, setNewBrandId] = useState(activeBrand || 'growthifyx')
  const [steps, setSteps] = useState<Array<{ agentId: string; title: string; prompt: string; workspace: 'workspace-lead-hunt' | 'workspace-marketing' }>>([
    { agentId: agentList[0]?.id || 'lead_collection_specialist', title: 'Step 1: Research', prompt: 'Collect 10 target business leads', workspace: 'workspace-lead-hunt' },
  ])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWorkflows(activeBrand)
      setWorkflows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [activeBrand])

  const handleRun = async (wf: Workflow) => {
    setRunningId(wf.id)
    setError(null)
    try {
      const res = await runWorkflow(wf.id)
      setNotice(`Workflow "${wf.title}" started! ${res.queuedSteps} task(s) queued.`)
      setTimeout(() => (onNavigateToTasks ? onNavigateToTasks() : onNavigate?.('tasks')), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunningId(null)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete workflow "${title}"?`)) return
    try {
      await deleteWorkflow(id)
      setWorkflows((prev) => prev.filter((w) => w.id !== id))
      setNotice(`Workflow "${title}" deleted.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        agentId: agentList[0]?.id || 'lead_collection_specialist',
        title: `Step ${prev.length + 1}`,
        prompt: '',
        workspace: 'workspace-marketing',
      },
    ])
  }

  const handleRemoveStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || steps.length === 0) return
    try {
      await createWorkflow({
        brandId: newBrandId,
        title: newTitle.trim(),
        description: newDesc.trim(),
        steps: steps.map((s, i) => ({ ...s, id: `step-${i + 1}` })),
      })
      setCreating(false)
      setNewTitle('')
      setNewDesc('')
      load()
      setNotice('New workflow pipeline created successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="management-view workflows-view">
      <div className="management-header">
        <div>
          <h2>Workflows & Automation Pipelines</h2>
          <p className="management-subtitle">
            Multi-step AI pipelines and bot-to-bot handoffs. Connect research, drafting, and execution sequentially.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            + Create Pipeline
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert-box success">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="alert-close">✕</button>
        </div>
      )}
      {error && <div className="alert-box error">{error}</div>}

      {/* Workflows Grid */}
      <div className="workflows-grid">
        {workflows.map((wf) => {
          const brandObj = brandList.find((b) => b.id === wf.brandId)
          const isRunning = runningId === wf.id

          return (
            <div key={wf.id} className="card workflow-card">
              <div className="workflow-card-header">
                <div className="workflow-title-block">
                  <div className="workflow-title-row">
                    <span className="workflow-title">{wf.title}</span>
                    {brandObj && (
                      <span className="badge-brand" style={{ backgroundColor: `${brandObj.color || '#18836B'}15`, color: brandObj.color || '#18836B' }}>
                        {brandObj.name}
                      </span>
                    )}
                  </div>
                  {wf.description && <p className="workflow-desc">{wf.description}</p>}
                </div>
                <div className="btn-group">
                  <button
                    type="button"
                    className="btn-primary btn-small"
                    onClick={() => handleRun(wf)}
                    disabled={isRunning}
                  >
                    {isRunning ? 'Queueing…' : '▶ Run Now'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-small text-danger"
                    onClick={() => handleDelete(wf.id, wf.title)}
                    title="Delete workflow"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Steps timeline */}
              <div className="workflow-steps-list">
                <span className="steps-heading">Pipeline Steps ({wf.steps.length}):</span>
                {wf.steps.map((st, i) => {
                  const botObj = agentList.find((a) => a.id === st.agentId)
                  return (
                    <div key={st.id || i} className="step-row">
                      <span className="step-num">{i + 1}</span>
                      <div className="step-detail">
                        <span className="step-title">{st.title}</span>
                        <span className="step-assignee">
                          Assigned to: <strong>{botObj?.name || st.agentId}</strong> ({st.workspace === 'workspace-lead-hunt' ? 'Lead Hunt' : 'Marketing'})
                        </span>
                        <span className="step-prompt-text">{st.prompt}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {wf.lastRunAt && (
                <div className="workflow-footer">
                  <span className="text-muted">Last executed: {new Date(wf.lastRunAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          )
        })}

        {workflows.length === 0 && (
          <div className="empty-state-box dot-grid-bg">
            <p className="empty-title">No workflows defined</p>
            <p className="empty-subtitle">Set up a multi-step pipeline connecting Lead Hunt to Marketing outreach.</p>
            <button type="button" className="btn-primary" onClick={() => setCreating(true)} style={{ marginTop: '12px' }}>
              + Create First Workflow
            </button>
          </div>
        )}
      </div>

      {/* Create Workflow Modal */}
      {creating && (
        <div className="modal-backdrop" onClick={() => setCreating(false)}>
          <div className="modal-card workflow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Workflow Pipeline</h3>
              <button type="button" className="modal-close-btn" onClick={() => setCreating(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="form-grid">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Pipeline Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Discovery & Outreach Follow-up"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Target Brand</label>
                  <select value={newBrandId} onChange={(e) => setNewBrandId(e.target.value)}>
                    {brandList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Researches local businesses and passes prospects to Marketing drafter"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Sequential Steps</label>
                  <button type="button" className="btn-secondary btn-small" onClick={handleAddStep}>
                    + Add Step
                  </button>
                </div>

                <div className="steps-builder-list">
                  {steps.map((st, idx) => (
                    <div key={idx} className="step-builder-item">
                      <div className="form-row-2">
                        <input
                          type="text"
                          placeholder="Step title"
                          value={st.title}
                          onChange={(e) => {
                            const updated = [...steps]
                            if (updated[idx]) updated[idx].title = e.target.value
                            setSteps(updated)
                          }}
                          required
                        />
                        <select
                          value={st.agentId}
                          onChange={(e) => {
                            const updated = [...steps]
                            if (updated[idx]) updated[idx].agentId = e.target.value
                            setSteps(updated)
                          }}
                        >
                          {agentList.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-row-2" style={{ marginTop: '8px' }}>
                        <select
                          value={st.workspace}
                          onChange={(e) => {
                            const updated = [...steps]
                            if (updated[idx]) updated[idx].workspace = e.target.value as any
                            setSteps(updated)
                          }}
                        >
                          <option value="workspace-lead-hunt">LEAD HUNT Workspace</option>
                          <option value="workspace-marketing">MARKETING Workspace</option>
                        </select>

                        {steps.length > 1 && (
                          <button
                            type="button"
                            className="btn-danger btn-small"
                            onClick={() => handleRemoveStep(idx)}
                          >
                            Remove Step
                          </button>
                        )}
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Task instructions for this step (natural Bangla or English)…"
                        value={st.prompt}
                        onChange={(e) => {
                          const updated = [...steps]
                          if (updated[idx]) updated[idx].prompt = e.target.value
                          setSteps(updated)
                        }}
                        style={{ marginTop: '8px' }}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!newTitle.trim()}>
                  Save Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
