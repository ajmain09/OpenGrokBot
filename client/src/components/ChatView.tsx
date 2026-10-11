import { useEffect, useRef, useState } from 'react'
import type { ApprovalRequest, Conversation, Message, Team, UsageSummary } from '../../../shared/types'
import { updateAgent } from '../api'
import { formatCost, formatDuration, formatTokens, modelLabel } from '../format'
import { conversationAvatars, conversationTitle, personFor, type Person } from '../people'
import { ApprovalCard } from './Approval'
import { Avatar, AvatarCluster } from './Avatar'
import type { ReplyTarget } from './Composer'
import { AttachmentList, attachmentFromPath, producedFiles } from './Preview'
import { RichText } from './RichText'

interface ChatViewProps {
  team: Team
  conversation: Conversation
  typing: Set<string>
  usage: UsageSummary
  approvals: ApprovalRequest[]
  jumpTo: string | null
  onEditAgent: (id: string) => void
  onReply: (target: ReplyTarget) => void
  profileOpen: boolean
  onStop?: () => void
}

interface Group {
  authorId: string
  messages: Message[]
}

function groupMessages(messages: Message[]): Group[] {
  const groups: Group[] = []
  for (const m of messages) {
    const last = groups[groups.length - 1]
    if (last && last.authorId === m.authorId && m.createdAt - (last.messages[last.messages.length - 1]?.createdAt ?? 0) < 5 * 60_000) {
      last.messages.push(m)
    } else {
      groups.push({ authorId: m.authorId, messages: [m] })
    }
  }
  return groups
}

function personOf(team: Team, id: string): Person {
  if (id === 'routine') return { id, label: 'ROUTINE', name: 'Routine', color: '#f59e0b', kind: 'agent' }
  return personFor(team, id)
}

export function ChatView({
  team,
  conversation,
  typing,
  usage,
  approvals,
  jumpTo,
  onEditAgent,
  onReply,
  profileOpen,
  onStop,
}: ChatViewProps) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const pinned = useRef(true)
  const [showInfo, setShowInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('ogb_members_open')
      return saved !== null ? saved === 'true' : false
    } catch {
      return false
    }
  })
  const togglePanel = () => {
    setShowInfo((prev) => {
      const next = !prev
      try {
        localStorage.setItem('ogb_members_open', String(next))
      } catch {}
      return next
    })
  }

  const groups = groupMessages(conversation.messages)
  const typingPeople = [...typing].filter((id) => !conversation.messages.some((m) => m.authorId === id && m.status === 'streaming')).map((id) => personFor(team, id))
  const pendingHere = approvals.filter((a) => a.conversationId === conversation.id)

  const lastMessage = conversation.messages[conversation.messages.length - 1]
  const lastKey = `${conversation.id}:${conversation.messages.length}:${lastMessage?.text.length ?? 0}:${typingPeople.length}:${pendingHere.length}`

  // Keep the view pinned to the bottom while streaming, unless the user scrolled up.
  useEffect(() => {
    const el = scroller.current
    if (!el || !pinned.current) return
    el.scrollTop = el.scrollHeight
  }, [lastKey])

  useEffect(() => {
    pinned.current = true
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conversation.id])

  useEffect(() => {
    if (!jumpTo) return
    const el = document.getElementById(`m-${jumpTo}`)
    if (!el) return
    pinned.current = false
    el.scrollIntoView({ block: 'center' })
    el.classList.add('is-highlight')
    const t = setTimeout(() => el.classList.remove('is-highlight'), 2000)
    return () => clearTimeout(t)
  }, [jumpTo])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const people = conversationAvatars(conversation).map((id) => personFor(team, id))
  const convUsage = usage.byConversation[conversation.id]
  const panel = showInfo && !profileOpen

  // Workspace-specific AI engine switcher
  const isLeadHunt = conversation.id === 'workspace-lead-hunt'
  const isMarketing = conversation.id === 'workspace-marketing'
  const primaryAgentId = isLeadHunt ? 'lead_collection_specialist' : isMarketing ? 'marketing' : null
  const primaryAgent = primaryAgentId ? team.agents.find((a) => a.id === primaryAgentId) : null

  const handleProviderChange = async (newProvider: string) => {
    if (!primaryAgent) return
    await updateAgent(primaryAgent.id, { provider: newProvider })
    window.dispatchEvent(
      new CustomEvent('update-agent-provider', {
        detail: { id: primaryAgent.id, provider: newProvider },
      })
    )
  }

  const isWorking = typingPeople.length > 0 || conversation.messages.some((m) => m.status === 'streaming')

  return (
    <section className="chat">
      <header className="chat-header">
        <AvatarCluster people={people} size={30} />
        <div className="chat-title-group">
          <h1 className="chat-title">{conversationTitle(team, conversation)}</h1>
          {primaryAgent && (
            <span className="chat-role-subtitle">
              {isLeadHunt ? 'Market Research & Public Lead Collection' : 'Marketing Outreach & Opt-in Follow-ups'}
            </span>
          )}
        </div>

        <div className="chat-header-actions">
          {/* Real AI Engine Selector directly in the chat header */}
          {primaryAgent && (
            <div className="chat-engine-switcher" title="AI Provider Engine">
              <span className="engine-label">Engine:</span>
              <select
                value={primaryAgent.provider || 'antigravity'}
                onChange={(e) => void handleProviderChange(e.target.value)}
                className="chat-provider-select"
              >
                <option value="antigravity">Google Antigravity (Google AI Pro)</option>
                <option value="codex">OpenAI Codex (ChatGPT)</option>
              </select>
              <span className={`engine-status-pill ${primaryAgent.provider === 'codex' ? 'codex' : 'antigravity'}`}>
                {primaryAgent.provider === 'codex' ? 'ChatGPT' : 'Google AI Pro'}
              </span>
            </div>
          )}

          {/* Active task indicator & stop button */}
          {isWorking && (
            <div className="active-task-indicator">
              <span className="pulse-dot" />
              <span className="task-working-text">Working…</span>
              {onStop && (
                <button type="button" className="btn-stop-chip" onClick={onStop} title="Stop agent execution">
                  Stop ⏹
                </button>
              )}
            </div>
          )}

          {convUsage && (
            <span className="chat-usage" title="Tokens and API-equivalent cost of this conversation">
              {formatTokens(convUsage.inputTokens + convUsage.cacheReadTokens + convUsage.cacheCreationTokens + convUsage.outputTokens)} tok · {formatCost(convUsage.costUsd)}
            </span>
          )}

          <button
            type="button"
            className={`members-toggle-btn${panel ? ' is-active' : ''}`}
            onClick={togglePanel}
            title={panel ? 'Collapse members panel' : 'Expand members panel'}
            aria-label={panel ? 'Collapse members panel' : 'Expand members panel'}
          >
            <UsersIcon />
            <span>{panel ? 'Hide Members' : 'Members'}</span>
          </button>
        </div>
      </header>

      <div className="chat-body">
        <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
          <div className="chat-messages">
            {groups.length === 0 && (
              <div className="chat-empty">
                <AvatarCluster people={people} size={56} />
                <p>
                  {isLeadHunt
                    ? 'Instruct the agent in natural Bangla or English (e.g. "ঢাকার শীর্ষ ২০টি আইটি কোম্পানির ফোন নম্বর ও ফেসবুক পেজ সংগ্রহ করো").'
                    : isMarketing
                    ? 'Provide instructions to analyze saved leads, draft personalized Bengali outreach, or plan follow-ups.'
                    : conversation.kind === 'group'
                    ? 'Say something and the right agents will collaborate.'
                    : `Talk to ${people[0]?.label ?? 'your assistant'} privately.`}
                </p>
              </div>
            )}
            {groups.map((g) => (
              <MessageGroup key={g.messages[0]?.id ?? g.authorId} team={team} group={g} onReply={onReply} />
            ))}
            {pendingHere.map((r) => (
              <ApprovalCard key={r.id} team={team} request={r} />
            ))}
            {typingPeople.map((p) => (
              <div key={p.id} className="message-group is-agent">
                <span className="message-label" style={{ color: p.color }}>
                  {p.label}
                </span>
                <div className="message-row">
                  <span className="message-avatar">
                    <Avatar person={p} size={28} />
                  </span>
                  <div className="bubble bubble-typing" aria-label={`${p.name} is typing`}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {panel && (
          <aside className="info-panel">
            <div className="info-panel-head">
              <h2>Members</h2>
              <button
                type="button"
                className="close-panel-btn"
                onClick={togglePanel}
                title="Collapse members"
                aria-label="Collapse members"
              >
                ✕
              </button>
            </div>
            {conversation.memberIds
              .filter((id) => id !== 'user')
              .map((id) => {
                const p = personFor(team, id)
                const a = p.agent
                const busy = typing.has(id)
                const u = usage.byAgent[id]
                return (
                  <button key={id} type="button" className="info-member" onClick={() => onEditAgent(id)} title="Edit profile">
                    <Avatar person={p} size={30} />
                    <span className="info-text">
                      <span className="info-name">{p.label}</span>
                      {a && (
                        <span className="info-meta">
                          {a.provider === 'codex' ? 'OpenAI Codex · ' : 'Google Antigravity · '}
                          {modelLabel(a.model)} · {a.effort}
                          {a.muted ? ' · muted' : ''}
                          {u ? ` · ${formatTokens(u.inputTokens + u.cacheReadTokens + u.cacheCreationTokens + u.outputTokens)} tok` : ''}
                        </span>
                      )}
                    </span>
                    {busy && <span className="dot" aria-label="typing" />}
                  </button>
                )
              })}
          </aside>
        )}
      </div>
    </section>
  )
}

function MessageGroup({ team, group, onReply }: { team: Team; group: Group; onReply: (t: ReplyTarget) => void }) {
  const person = personOf(team, group.authorId)
  const mine = person.kind === 'owner'
  const isRoutine = group.authorId === 'routine'
  return (
    <div className={`message-group ${mine ? 'is-mine' : 'is-agent'}${isRoutine ? ' is-routine' : ''}`}>
      {!mine && (
        <span className="message-label" style={{ color: person.color }}>
          {person.label}
        </span>
      )}
      {group.messages.map((m, i) => {
        const last = i === group.messages.length - 1
        const shared = m.attachments && m.attachments.length > 0 ? m.attachments : !mine && m.status === 'done' ? producedFiles(m.text).map(attachmentFromPath) : []
        return (
          <div key={m.id} id={`m-${m.id}`} className="message-row">
            {!mine && <span className="message-avatar">{last && (isRoutine ? <span className="routine-avatar">⏰</span> : <Avatar person={person} size={28} />)}</span>}
            <div className="bubble-wrap">
              {m.replyTo && (
                <div className="reply-quote" dir="auto">
                  <strong>{m.replyTo.authorId === 'user' ? team.owner.name : personOf(team, m.replyTo.authorId).name}</strong> {m.replyTo.excerpt}
                </div>
              )}
              <div dir="auto" className={`bubble${m.status === 'streaming' ? ' is-streaming' : ''}${m.status === 'error' ? ' is-error' : ''}`}>
                {m.activity && m.activity.length > 0 && (
                  <div className="activity">
                    {m.activity.slice(-4).map((line, j) => (
                      <div key={j} className="activity-line">
                        <ToolIcon />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.text.length > 0 ? <RichText text={m.text} team={team} /> : m.status === 'streaming' ? <span className="working">working…</span> : null}
              </div>
              {shared.length > 0 && <AttachmentList items={shared} team={team} />}
              <div className="message-meta">
                {m.usage && (
                  <span>
                    {modelLabel(m.usage.model)} · {formatTokens(m.usage.inputTokens + m.usage.cacheReadTokens + m.usage.cacheCreationTokens)} in · {formatTokens(m.usage.outputTokens)} out · {formatCost(m.usage.costUsd)} · {formatDuration(m.usage.durationMs)}
                    {m.usage.numTurns > 1 ? ` · ${m.usage.numTurns} steps` : ''}
                  </span>
                )}
                {m.status === 'done' && m.text && (
                  <button type="button" className="link" onClick={() => onReply({ messageId: m.id, authorId: m.authorId, excerpt: m.text.replace(/\s+/g, ' ').slice(0, 120) })}>
                    Reply
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ToolIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6l6 4-6 4M11 15h5" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 16v-1.5a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3V16" />
      <circle cx="8.5" cy="5.5" r="3" />
      <path d="M17 16v-1.5a2.7 2.7 0 0 0-2-2.6M13.5 3a3 3 0 0 1 0 5.6" />
    </svg>
  )
}
