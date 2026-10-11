import { useEffect, useState } from 'react'
import type { Lead, LeadSummary } from '../../../shared/types'
import { leadExportUrl, listLeads } from '../api'

const EMPTY: LeadSummary = { total: 0, verified: 0, partiallyVerified: 0, unverified: 0 }

export function Leads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [summary, setSummary] = useState<LeadSummary>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
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

  useEffect(() => { void refresh() }, [])

  return (
    <>
      <div className="marketplace-head">
        <h1>Leads</h1>
        <div className="row-control">
          <button type="button" className="btn" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <a className="btn btn-primary" href={leadExportUrl()} download>Export CSV</a>
        </div>
      </div>
      <p className="lead">Local public-business leads collected by your research employees. Missing fields stay blank; source URLs and verification status travel with every CSV export.</p>
      {error && <div className="form-error">{error}</div>}
      <div className="stats">
        <div className="stat"><strong>{summary.total}</strong><span>Total leads</span></div>
        <div className="stat"><strong>{summary.verified}</strong><span>Verified</span></div>
        <div className="stat"><strong>{summary.partiallyVerified}</strong><span>Partially verified</span></div>
        <div className="stat"><strong>{summary.unverified}</strong><span>Unverified</span></div>
      </div>
      <div className="card table-wrap">
        {leads.length === 0 ? <p className="muted">No leads collected yet. Ask the Lead Collection Specialist to research a public business category and export the CSV.</p> : (
          <table className="table">
            <thead><tr><th>Business</th><th>Industry</th><th>Location</th><th>Phone</th><th>Verification</th><th>Collected</th></tr></thead>
            <tbody>{leads.slice(0, 100).map((lead) => (
              <tr key={lead.id}>
                <td><a href={lead.sourceUrl} target="_blank" rel="noreferrer">{lead.businessName}</a></td>
                <td>{lead.industry || '—'}</td>
                <td>{lead.districtLocation || '—'}</td>
                <td>{lead.publicBusinessPhone || '—'}</td>
                <td>{lead.verificationStatus}</td>
                <td>{lead.collectionDate}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  )
}
