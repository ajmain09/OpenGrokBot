import { useEffect, useState } from 'react'
import type { MemoryItem } from '../../../shared/types'
import { addMemory, clearMemories, deleteMemoryItem, listMemories, searchMemories, updateMemoryItem } from '../api'

export function MemoryManagerView() {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [scope, setScope] = useState<'all' | 'lead-hunt' | 'marketing' | 'shared'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null)

  // Add Memory form
  const [newTitle, setNewTitle] = useState('')
  const [newScope, setNewScope] = useState<'lead-hunt' | 'marketing' | 'shared'>('shared')
  const [newCategory, setNewCategory] = useState<'preference' | 'instruction' | 'fact' | 'history' | 'task'>('instruction')
  const [newContent, setNewContent] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      if (search.trim()) {
        const res = await searchMemories(search.trim())
        setItems(res)
      } else {
        const res = await listMemories(scope === 'all' ? undefined : scope)
        setItems(res)
      }
    } catch {
      // error handling
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [scope, search])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return
    setAdding(true)
    try {
      await addMemory({
        title: newTitle.trim(),
        scope: newScope,
        category: newCategory,
        content: newContent.trim(),
      })
      setNewTitle('')
      setNewContent('')
      load()
    } finally {
      setAdding(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingItem) return
    try {
      await updateMemoryItem(editingItem.id, editingItem)
      setEditingItem(null)
      load()
    } catch {
      // ignore
    }
  }

  return (
    <div className="management-view memory-manager-view">
      <div className="management-header">
        <div>
          <h2>AI Memory</h2>
          <p className="management-subtitle">
            Persistent rules, preferences, and verified business facts injected contextually into agent turns.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={async () => {
              if (window.confirm('Are you sure you want to clear the selected memory items?')) {
                await clearMemories(scope === 'all' ? undefined : scope)
                load()
              }
            }}
          >
            Clear Memories
          </button>
        </div>
      </div>

      {/* Add Memory Card */}
      <div className="card new-memory-card">
        <h3>Add Persistent Memory</h3>
        <form onSubmit={handleAdd} className="memory-form">
          <div className="form-row">
            <input
              type="text"
              placeholder="Title (e.g. Outreach tone guidelines / Target audience rules)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="task-title-input"
              required
            />
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as any)}
              className="task-ws-select"
            >
              <option value="shared">Shared (All Workspaces)</option>
              <option value="lead-hunt">Lead Hunt Only</option>
              <option value="marketing">Marketing Only</option>
            </select>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="task-ws-select"
            >
              <option value="instruction">Instruction</option>
              <option value="preference">Preference</option>
              <option value="fact">Business Fact</option>
              <option value="task">Task Standard</option>
              <option value="history">History</option>
            </select>
          </div>
          <textarea
            rows={2}
            placeholder="Memory details (in natural Bangla or English, e.g. 'আউটরিচ মেসেজ সবসময় ভদ্র ও পেশাদার বাংলায় লিখতে হবে। কোনো পাসওয়ার্ড সংরক্ষণ করবেন না')…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="task-prompt-input"
            required
          />
          <div className="form-footer">
            <span className="task-hint">
              🔒 Stored securely on local disk. Never store passwords, tokens, or API keys in memory.
            </span>
            <button type="submit" className="btn-primary" disabled={adding || !newTitle.trim()}>
              {adding ? 'Saving…' : 'Save Memory'}
            </button>
          </div>
        </form>
      </div>

      {/* Filters & Search */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search memories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="tab-bar-inline">
          <button
            type="button"
            className={`tab-btn-sm ${scope === 'all' ? 'active' : ''}`}
            onClick={() => setScope('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`tab-btn-sm ${scope === 'shared' ? 'active' : ''}`}
            onClick={() => setScope('shared')}
          >
            Shared
          </button>
          <button
            type="button"
            className={`tab-btn-sm ${scope === 'lead-hunt' ? 'active' : ''}`}
            onClick={() => setScope('lead-hunt')}
          >
            Lead Hunt
          </button>
          <button
            type="button"
            className={`tab-btn-sm ${scope === 'marketing' ? 'active' : ''}`}
            onClick={() => setScope('marketing')}
          >
            Marketing
          </button>
        </div>
      </div>

      {/* Memory Items List */}
      <div className="memory-grid">
        {items.length === 0 ? (
          <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
            <p>No memory items found matching current filters.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="card memory-card">
              <div className="memory-card-header">
                <div className="memory-badges">
                  <span className={`badge-scope scope-${item.scope}`}>{item.scope.toUpperCase()}</span>
                  <span className="badge-cat">{item.category}</span>
                </div>
                <div className="memory-actions">
                  <button
                    type="button"
                    className="btn-icon"
                    title="Edit"
                    onClick={() => setEditingItem({ ...item })}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Delete"
                    onClick={async () => {
                      await deleteMemoryItem(item.id)
                      load()
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
              <h4 className="memory-title">{item.title}</h4>
              <p className="memory-content">{item.content}</p>
              <div className="memory-footer">
                <span className="memory-time">Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit Memory</h3>
              <button type="button" className="btn-close" onClick={() => setEditingItem(null)}>✕</button>
            </div>
            <div className="modal-body form-grid">
              <label>
                <span>Title</span>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                />
              </label>
              <label>
                <span>Scope</span>
                <select
                  value={editingItem.scope}
                  onChange={(e) => setEditingItem({ ...editingItem, scope: e.target.value as any })}
                >
                  <option value="shared">Shared</option>
                  <option value="lead-hunt">Lead Hunt</option>
                  <option value="marketing">Marketing</option>
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <span>Content</span>
                <textarea
                  rows={4}
                  value={editingItem.content}
                  onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
