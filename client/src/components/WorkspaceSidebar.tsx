import { useEffect, useState } from 'react'
import type { ApprovalRequest, Conversation } from '../../../shared/types'
import { DEFAULT_BRANDS } from '../../../shared/types'

interface NavItem {
  id: string
  title: string
  icon: string
  type: 'workspace' | 'tool'
  detail?: string
}

interface NavGroup {
  id: string
  title: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    title: 'OVERVIEW',
    items: [
      { id: 'dashboard', title: 'Dashboard', icon: '📊', type: 'tool', detail: 'System Overview & Live Stats' },
    ],
  },
  {
    id: 'ai-workspace',
    title: 'AI WORKSPACE',
    items: [
      { id: 'workspace-lead-hunt', title: 'Lead Hunt', icon: '🎯', type: 'workspace', detail: 'Market Research & Lead Collection' },
      { id: 'workspace-marketing', title: 'Marketing', icon: '📢', type: 'workspace', detail: 'Personalized Bengali Outreach' },
    ],
  },
  {
    id: 'management',
    title: 'MANAGEMENT',
    items: [
      { id: 'leads', title: 'Lead Manager', icon: '👥', type: 'tool', detail: 'Lead Database & CSV Export' },
      { id: 'tasks', title: 'Task Manager', icon: '⚡', type: 'tool', detail: 'Background Task Queue' },
      { id: 'memory', title: 'AI Memory', icon: '🧠', type: 'tool', detail: 'Persistent Rules & Preferences' },
      { id: 'outputs', title: 'Output Manager', icon: '📁', type: 'tool', detail: 'Generated Files & Folders' },
      { id: 'browser', title: 'Browser Manager', icon: '🌐', type: 'tool', detail: 'Dedicated Chrome Profiles' },
      { id: 'approvals', title: 'Approval Center', icon: '🛡️', type: 'tool', detail: 'Tool Execution Safeguards' },
    ],
  },
  {
    id: 'advanced',
    title: 'ADVANCED',
    items: [
      { id: 'skills', title: 'Skills & Tools', icon: '🧩', type: 'tool', detail: 'Reusable Prompts & Tool Catalog' },
      { id: 'routines', title: 'Automation Routines', icon: '⏰', type: 'tool', detail: 'Scheduled Tasks & Webhooks' },
      { id: 'logs', title: 'Activity Logs', icon: '📋', type: 'tool', detail: 'Audit Trail & Operations' },
    ],
  },
  {
    id: 'system',
    title: 'SYSTEM',
    items: [
      { id: 'settings', title: 'Settings', icon: '⚙️', type: 'tool', detail: 'Provider & Workspace Config' },
    ],
  },
]

interface WorkspaceSidebarProps {
  conversations: Conversation[]
  activeId: string
  busy: Set<string>
  approvals: ApprovalRequest[]
  onSelect: (id: string) => void
  onSettings?: () => void
  zoom?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
  activeBrand?: string
  onBrandChange?: (brandId: string) => void
}

export function WorkspaceSidebar({
  conversations,
  activeId,
  busy,
  approvals,
  onSelect,
  onSettings,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  theme = 'light',
  onToggleTheme,
  activeBrand = 'growthifyx',
  onBrandChange,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('ogb_sidebar_collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('ogb_sidebar_collapsed', String(collapsed))
  }, [collapsed])

  const existingConvs = new Set(conversations.map((c) => c.id))
  const needsApproval = new Set(approvals.map((a) => a.conversationId))
  const pendingApprovalsCount = approvals.length

  return (
    <aside className={`workspace-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      {/* Brand & Collapse Header */}
      <div className="workspace-brand">
        <div className="workspace-brand-left" onClick={() => onSelect('dashboard')} style={{ cursor: 'pointer' }}>
          <span className="workspace-brand-mark">OG</span>
          {!collapsed && (
            <div className="brand-text-col">
              <span className="workspace-brand-name">OpenGrokBot</span>
              <span className="workspace-brand-sub">AI Employee Studio</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="sidebar-toggle-btn"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Brand Workspace Switcher */}
      {!collapsed ? (
        <div className="brand-selector-wrap">
          <label className="brand-selector-label">Brand Workspace</label>
          <select
            className="brand-select"
            value={activeBrand}
            onChange={(e) => onBrandChange?.(e.target.value)}
            title="Switch Active Brand Workspace"
            aria-label="Active Brand Workspace"
          >
            {DEFAULT_BRANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div
          className="brand-selector-collapsed"
          title={`Active Brand: ${activeBrand === 'the-solver-agency' ? 'The Solver Agency' : 'Growthifyx'}`}
          onClick={() => onBrandChange?.(activeBrand === 'the-solver-agency' ? 'growthifyx' : 'the-solver-agency')}
        >
          <span
            className="brand-dot"
            style={{ backgroundColor: activeBrand === 'the-solver-agency' ? '#2B6CB0' : '#18836B' }}
          />
        </div>
      )}

      {/* Main Navigation Groups */}
      <nav className="workspace-list" aria-label="Main Navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="workspace-nav-group">
            {!collapsed && <div className="nav-group-title">{group.title}</div>}
            {group.items.map((item) => {
              const isActive = item.id === activeId
              const isBusyWs = busy.has(item.id)
              const needsAppr = item.id === 'approvals' ? pendingApprovalsCount > 0 : needsApproval.has(item.id)
              const disabled = item.type === 'workspace' && !existingConvs.has(item.id)

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-row ${isActive ? 'is-active' : ''} ${item.type === 'workspace' ? 'row-ws' : 'row-tool'}`}
                  disabled={disabled}
                  title={collapsed ? `${item.title}: ${item.detail || ''}` : undefined}
                  onClick={() => {
                    if (item.id === 'settings' && onSettings) {
                      onSelect('settings')
                    } else {
                      onSelect(item.id)
                    }
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && (
                    <div className="nav-text-block">
                      <span className="workspace-title">{item.title}</span>
                      {item.detail && <span className="workspace-detail">{item.detail}</span>}
                    </div>
                  )}
                  {needsAppr && (
                    <span className="badge-notification">
                      {item.id === 'approvals' ? pendingApprovalsCount : '!'}
                    </span>
                  )}
                  {isBusyWs && !needsAppr && (
                    <span className="badge-busy" title="In progress…">●</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Controls Bar */}
      <div className="workspace-sidebar-bottom">
        <div className="sidebar-bottom-row">
          {/* Zoom controls */}
          <div className="zoom-controls-bar" title="Zoom: Ctrl + / Ctrl - / Ctrl 0">
            <button
              type="button"
              className="zoom-btn"
              onClick={onZoomOut}
              title="Zoom Out (Ctrl -)"
              aria-label="Zoom Out"
            >
              −
            </button>
            <button
              type="button"
              className="zoom-btn zoom-val"
              onClick={onZoomReset}
              title="Reset Zoom (Ctrl 0)"
              aria-label="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={onZoomIn}
              title="Zoom In (Ctrl +)"
              aria-label="Zoom In"
            >
              +
            </button>
          </div>

          {/* Theme toggle */}
          {onToggleTheme && (
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
              {!collapsed && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
