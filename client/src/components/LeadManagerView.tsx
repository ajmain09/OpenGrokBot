import { useEffect, useRef, useState } from 'react'
import type { Lead, LeadOutreachStatus, LeadSummary, LeadVerificationStatus } from '../../../shared/types'
import { deleteLead, importLeads, leadExportUrl, listLeads, sendLeadsToMarketing, updateLead } from '../api'

interface LeadManagerViewProps {
  onNavigateToMarketing?: () => void
}

export function LeadManagerView({ onNavigateToMarketing }: LeadManagerViewProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [summary, setSummary] = useState<LeadSummary>({ total: 0, verified: 0, partiallyVerified: 0, unverified: 0 })
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [verFilter, setVerFilter] = useState<string>('all')
  const [outreachFilter, setOutreachFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listLeads()
      setLeads(data.leads)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Extract distinct industries and locations for filters
  const uniqueIndustries = Array.from(new Set(leads.map((l) => l.industry?.trim()).filter(Boolean) as string[])).sort()
  const uniqueLocations = Array.from(new Set(leads.map((l) => l.districtLocation?.trim()).filter(Boolean) as string[])).sort()

  const filtered = leads.filter((lead) => {
    if (industryFilter !== 'all' && lead.industry?.trim() !== industryFilter) return false
    if (locationFilter !== 'all' && lead.districtLocation?.trim() !== locationFilter) return false
    if (verFilter !== 'all' && lead.verificationStatus !== verFilter) return false
    if (outreachFilter !== 'all' && lead.outreachStatus !== outreachFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const haystack = `${lead.businessName} ${lead.industry} ${lead.districtLocation} ${lead.publicBusinessPhone} ${lead.officialWebsite}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleSendToMarketing = async () => {
    if (selectedIds.size === 0) return
    try {
      const res = await sendLeadsToMarketing(Array.from(selectedIds))
      setNotice(`${res.count} lead(s) forwarded to Marketing workspace!`)
      setSelectedIds(new Set())
      if (onNavigateToMarketing) {
        setTimeout(() => onNavigateToMarketing(), 1200)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSaveEdit = async () => {
    if (!editingLead) return
    try {
      const res = await updateLead(editingLead.id, editingLead)
      setLeads(leads.map((l) => (l.id === res.lead.id ? res.lead : l)))
      setEditingLead(null)
      setNotice('Lead updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDeleteLead = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      await deleteLead(id)
      setLeads(leads.filter((l) => l.id !== id))
      if (editingLead?.id === id) setEditingLead(null)
      setNotice(`"${name}" has been deleted.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      let payload: unknown
      if (file.name.endsWith('.json')) {
        payload = JSON.parse(text)
      } else {
        // Parse CSV to lead objects
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length <= 1) throw new Error('CSV file contains no data.')
        const headers = lines[0]?.split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase()) ?? []
        const parsedLeads = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i]?.split(',').map((c) => c.replace(/^"|"$/g, '').trim()) ?? []
          const leadObj: Record<string, string> = {}
          headers.forEach((h, idx) => {
            if (cols[idx]) {
              if (h.includes('name') || h.includes('business')) leadObj.businessName = cols[idx]
              else if (h.includes('industry')) leadObj.industry = cols[idx]
              else if (h.includes('district') || h.includes('location')) leadObj.districtLocation = cols[idx]
              else if (h.includes('phone')) leadObj.publicBusinessPhone = cols[idx]
              else if (h.includes('website')) leadObj.officialWebsite = cols[idx]
              else if (h.includes('facebook') || h.includes('fb')) leadObj.facebookPageUrl = cols[idx]
              else if (h.includes('source')) leadObj.sourceUrl = cols[idx]
            }
          })
          if (leadObj.businessName) parsedLeads.push(leadObj)
        }
        payload = { leads: parsedLeads }
      }

      const res = await importLeads(payload)
      setNotice(`Import complete: ${res.created} new leads created, ${res.updated} updated.`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="management-view lead-manager-view">
      <div className="management-header">
        <div>
          <h2>Lead Manager</h2>
          <p className="management-subtitle">
            Public business leads collected by Lead Hunt. Persisted locally and deduplicated.
          </p>
        </div>
        <div className="btn-group">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".csv,.json"
            onChange={(e) => void handleImportFile(e)}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Import (CSV/JSON)
          </button>
          <a className="btn-secondary" href={leadExportUrl()} download>
            Export CSV ⬇
          </a>
          <button
            type="button"
            className="btn-primary"
            disabled={selectedIds.size === 0}
            onClick={handleSendToMarketing}
          >
            Send to Marketing ({selectedIds.size})
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

      {/* Summary KPI */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Leads</span>
          <span className="stat-value">{summary.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Verified Leads</span>
          <span className="stat-value text-success">{summary.verified}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Partially Verified</span>
          <span className="stat-value text-warning">{summary.partiallyVerified}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Unverified</span>
          <span className="stat-value text-muted">{summary.unverified}</span>
        </div>
      </div>

      {/* Search & Multi-Filters Bar */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by business name, industry, location, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-select"
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
        >
          <option value="all">All Industries ({uniqueIndustries.length})</option>
          {uniqueIndustries.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        >
          <option value="all">All Locations ({uniqueLocations.length})</option>
          {uniqueLocations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={verFilter}
          onChange={(e) => setVerFilter(e.target.value)}
        >
          <option value="all">All Verifications</option>
          <option value="verified">Verified</option>
          <option value="partially-verified">Partially Verified</option>
          <option value="unverified">Unverified</option>
        </select>

        <select
          className="filter-select"
          value={outreachFilter}
          onChange={(e) => setOutreachFilter(e.target.value)}
        >
          <option value="all">All Outreach Statuses</option>
          <option value="not-contacted">Not Contacted</option>
          <option value="review-needed">Review Needed</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="not-a-fit">Not a Fit</option>
        </select>
      </div>

      {/* Leads Table */}
      <div className="card table-container">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No leads found matching your criteria.</p>
            <span className="empty-subtext">Instruct Lead Hunt in natural language to research targeted leads or import records above.</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '38px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Business Name</th>
                <th>Industry</th>
                <th>Location</th>
                <th>Phone Number</th>
                <th>Website / FB</th>
                <th>Verification</th>
                <th>Outreach</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className={selectedIds.has(lead.id) ? 'row-selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  <td>
                    <strong>{lead.businessName}</strong>
                    {lead.sourceUrl && (
                      <div className="table-sublink">
                        <a href={lead.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>
                      </div>
                    )}
                  </td>
                  <td>{lead.industry || '—'}</td>
                  <td>{lead.districtLocation || '—'}</td>
                  <td>{lead.publicBusinessPhone || '—'}</td>
                  <td>
                    {lead.officialWebsite && (
                      <a href={lead.officialWebsite} target="_blank" rel="noreferrer" className="site-link">
                        Web
                      </a>
                    )}
                    {lead.facebookPageUrl && (
                      <a href={lead.facebookPageUrl} target="_blank" rel="noreferrer" className="site-link">
                        FB
                      </a>
                    )}
                    {!lead.officialWebsite && !lead.facebookPageUrl && '—'}
                  </td>
                  <td>
                    <span className={`status-pill pill-${lead.verificationStatus}`}>
                      {lead.verificationStatus}
                    </span>
                  </td>
                  <td>
                    <span className="status-pill">
                      {lead.outreachStatus}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setEditingLead({ ...lead })}
                      style={{ marginRight: '8px' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-link text-danger"
                      onClick={() => handleDeleteLead(lead.id, lead.businessName)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editingLead && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit Lead</h3>
              <button type="button" className="btn-close" onClick={() => setEditingLead(null)}>✕</button>
            </div>
            <div className="modal-body form-grid">
              <label>
                <span>Business Name</span>
                <input
                  type="text"
                  value={editingLead.businessName}
                  onChange={(e) => setEditingLead({ ...editingLead, businessName: e.target.value })}
                />
              </label>

              <label>
                <span>Industry</span>
                <input
                  type="text"
                  value={editingLead.industry}
                  onChange={(e) => setEditingLead({ ...editingLead, industry: e.target.value })}
                />
              </label>

              <label>
                <span>Location / District</span>
                <input
                  type="text"
                  value={editingLead.districtLocation}
                  onChange={(e) => setEditingLead({ ...editingLead, districtLocation: e.target.value })}
                />
              </label>

              <label>
                <span>Phone Number</span>
                <input
                  type="text"
                  value={editingLead.publicBusinessPhone}
                  onChange={(e) => setEditingLead({ ...editingLead, publicBusinessPhone: e.target.value })}
                />
              </label>

              <label>
                <span>Official Website</span>
                <input
                  type="text"
                  value={editingLead.officialWebsite}
                  onChange={(e) => setEditingLead({ ...editingLead, officialWebsite: e.target.value })}
                />
              </label>

              <label>
                <span>Facebook Page</span>
                <input
                  type="text"
                  value={editingLead.facebookPageUrl}
                  onChange={(e) => setEditingLead({ ...editingLead, facebookPageUrl: e.target.value })}
                />
              </label>

              <label>
                <span>Verification Status</span>
                <select
                  value={editingLead.verificationStatus}
                  onChange={(e) =>
                    setEditingLead({
                      ...editingLead,
                      verificationStatus: e.target.value as LeadVerificationStatus,
                    })
                  }
                >
                  <option value="verified">Verified</option>
                  <option value="partially-verified">Partially Verified</option>
                  <option value="unverified">Unverified</option>
                </select>
              </label>

              <label>
                <span>Outreach Status</span>
                <select
                  value={editingLead.outreachStatus}
                  onChange={(e) =>
                    setEditingLead({
                      ...editingLead,
                      outreachStatus: e.target.value as LeadOutreachStatus,
                    })
                  }
                >
                  <option value="not-contacted">Not Contacted</option>
                  <option value="review-needed">Review Needed</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="not-a-fit">Not a Fit</option>
                </select>
              </label>

              <label style={{ gridColumn: '1 / -1' }}>
                <span>Marketing Opportunity & Notes</span>
                <textarea
                  rows={3}
                  value={editingLead.marketingOpportunity}
                  onChange={(e) => setEditingLead({ ...editingLead, marketingOpportunity: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => handleDeleteLead(editingLead.id, editingLead.businessName)}
              >
                Delete Lead
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingLead(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleSaveEdit}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
