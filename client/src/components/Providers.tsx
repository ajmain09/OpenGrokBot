import { useEffect, useState } from 'react'
import { PROVIDER_KINDS } from '../../../shared/catalog'
import type { ProviderStatus, Team } from '../../../shared/types'
import { providerStatuses, updateAgent } from '../api'

interface ProvidersProps {
  team: Team
}

const VISIBLE_PROVIDERS = ['antigravity', 'codex']

export function Providers({ team }: ProvidersProps) {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([])
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (force = false) => {
    setChecking(true)
    try {
      setStatuses(await providerStatuses(force))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setChecking(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [team.providers])

  const usersOf = (id: string) => team.agents.filter((a) => a.provider === id).map((a) => a.name)
  const statusOf = (id: string) => statuses.find((s) => s.id === id)

  const leadAgent = team.agents.find((a) => a.id === 'lead_collection_specialist')
  const marketingAgent = team.agents.find((a) => a.id === 'marketing')

  return (
    <>
      <div className="marketplace-head">
        <h1>AI Providers</h1>
        <div className="row-control">
          <button type="button" className="btn" onClick={() => void refresh(true)} disabled={checking}>
            {checking ? 'Checking…' : 'Re-check Connection'}
          </button>
        </div>
      </div>
      <p className="lead">
        OpenGrokBot runs on your authenticated subscriptions through official CLIs without Gemini API keys or per-token fees.
      </p>
      {error && <div className="form-error">{error}</div>}

      <h4>Workspace AI Engine Selector</h4>
      <div className="card">
        <div className="row">
          <div className="row-text">
            <div className="row-title">LEAD HUNT (Research)</div>
            <div className="row-hint">Active engine: {leadAgent?.provider === 'codex' ? 'OpenAI Codex' : 'Google Antigravity'}</div>
          </div>
          <div className="row-control">
            <select
              value={leadAgent?.provider || 'antigravity'}
              onChange={async (e) => {
                await updateAgent('lead_collection_specialist', { provider: e.target.value })
              }}
              className="select"
            >
              <option value="antigravity">Google Antigravity (Google AI Pro - Default)</option>
              <option value="codex">OpenAI Codex (ChatGPT Subscription)</option>
            </select>
          </div>
        </div>

        <div className="row">
          <div className="row-text">
            <div className="row-title">MARKETING (Outreach & Drafts)</div>
            <div className="row-hint">Active engine: {marketingAgent?.provider === 'codex' ? 'OpenAI Codex' : 'Google Antigravity'}</div>
          </div>
          <div className="row-control">
            <select
              value={marketingAgent?.provider || 'antigravity'}
              onChange={async (e) => {
                await updateAgent('marketing', { provider: e.target.value })
              }}
              className="select"
            >
              <option value="antigravity">Google Antigravity (Google AI Pro - Default)</option>
              <option value="codex">OpenAI Codex (ChatGPT Subscription)</option>
            </select>
          </div>
        </div>
      </div>

      <h4>Connected AI Subscriptions</h4>
      <div className="card">
        {VISIBLE_PROVIDERS.map((id) => {
          const p = team.providers[id]
          if (!p) return null
          const st = statusOf(id)
          const kind = PROVIDER_KINDS.find((k) => k.id === p.kind)
          const users = usersOf(id)
          return (
            <div key={id} className="row">
              <span className={`status-dot${st ? (st.ok ? ' ok' : ' bad') : ''}`} />
              <div className="row-text">
                <div className="row-title">
                  {p.label}
                  {id === 'antigravity' && <span className="badge" style={{ background: '#22A06B', color: '#fff', marginLeft: '8px' }}>Default</span>}
                </div>
                <div className="row-hint">{st ? st.detail : kind?.hint}</div>
                <div className="row-hint">{users.length ? `Used in: ${users.join(', ')}` : 'Alternative provider'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
