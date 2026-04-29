// Shell: Sidebar, Topbar, App skeleton
const { useState, useEffect, useRef, useMemo } = React;

function Sidebar({ view, setView, collapsed, onNew }) {
  const navs = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'chat', label: 'New Consultation', icon: 'sparkle' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'templates', label: 'Templates', icon: 'layers', badge: '6' },
    { id: 'sources', label: 'Knowledge Base', icon: 'database' },
    { id: 'updates', label: 'Regulatory Updates', icon: 'flag', badge: '4' },
    { id: 'dashboard', label: 'Dashboard', icon: 'bar' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-mark">R</div>
        <div style={{ lineHeight: 1.15 }}>
          <div className="logo-word">Regula</div>
          <div className="logo-tag">RA · Med Device</div>
        </div>
      </div>

      <button className="sidebar-new" onClick={onNew}>
        <Icon name="plus" size={14} />
        New consultation
        <kbd>⌘ K</kbd>
      </button>

      <div className="sidebar-search">
        <Icon name="search" size={14} />
        <input placeholder="검색… (문서, 이전 질의)" />
      </div>

      <div className="sidebar-list">
        <div className="sidebar-section">Workspace</div>
        {navs.map(n => (
          <a key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)}>
            <Icon name={n.icon} size={15} />
            <span>{n.label}</span>
            {n.badge && <span className="nav-item-badge">{n.badge}</span>}
          </a>
        ))}

        <div className="sidebar-section" style={{ marginTop: 8 }}>
          Projects
          <Icon name="plus" size={12} style={{ cursor: 'pointer', opacity: 0.6 }} />
        </div>
        {DATA.projects.map(p => (
          <div key={p.id} className="project-item">
            <span className="project-dot" style={{ background: p.dot }} />
            <span className="project-title">{p.title}</span>
            <span className="project-count">{p.count}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-row">
          <div className="avatar">SJ</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">Seojin Park</div>
            <div className="user-role">QA / 개발팀 · Pro</div>
          </div>
          <Icon name="settings" size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, theme, setTheme, onTweaks, right }) {
  return (
    <div className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep"><Icon name="right" size={12} /></span>}
            <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="topbar-spacer" />
      {right}
      <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="테마 전환">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>
      <button className="icon-btn" title="공유"><Icon name="share" size={15} /></button>
      <button className="btn btn-sm" title="전문가 검토 요청">
        <Icon name="shield" size={13} /> 전문가 검토
      </button>
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
