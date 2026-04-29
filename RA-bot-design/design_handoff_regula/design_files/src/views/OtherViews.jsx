// Other views: History, Templates, Updates, Dashboard, DocViewer, Onboarding
function HistoryView({ onOpen }) {
  const [filter, setFilter] = useState('all');
  return (
    <div className="content">
      <div className="content-inner wide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>상담 이력</h1>
            <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>지금까지의 질의 {DATA.history.length}건</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all','active','archived'].map(f => (
              <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? '전체' : f === 'active' ? '진행중' : '보관'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          {DATA.history.map((h, i) => (
            <div key={h.id} onClick={() => onOpen(h.q)}
              style={{ padding: '16px 20px', borderBottom: i < DATA.history.length - 1 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'background 120ms' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-50)', color: 'var(--brand-700)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="message" size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500, lineHeight: 1.4, marginBottom: 6 }}>{h.q}</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <span><Icon name="folder" size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{h.project}</span>
                  <span><Icon name="clock" size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{h.when}</span>
                  <span><Icon name="book" size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{h.citations} citations</span>
                </div>
              </div>
              <Icon name="right" size={14} style={{ color: 'var(--text-muted)', marginTop: 10 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatesView() {
  return (
    <div className="content">
      <div className="content-inner wide">
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>템플릿</h1>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 24 }}>
          규제별 제출 문서와 내부 SOP의 검증된 양식을 바로 사용하세요.
        </p>
        <div className="tpl-grid">
          {DATA.templates.map(t => (
            <div key={t.id} className="tpl-card">
              <div className="tpl-icon"><Icon name={t.icon} size={16} /></div>
              <div className="tpl-title">{t.title}</div>
              <div className="tpl-desc">{t.desc}</div>
              <div className="tpl-foot">
                <span className="mono">{t.tag}</span>
                <span>{t.uses} 회 사용</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UpdatesView() {
  return (
    <div className="content">
      <div className="content-inner wide">
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>규제 업데이트</h1>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 24 }}>
          귀사 제품에 영향을 줄 수 있는 규제 변경을 자동 모니터링합니다.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DATA.updates.map((u, i) => (
            <div key={i} className="card" style={{ borderLeft: `3px solid ${u.severity === 'high' ? 'var(--amber-500)' : 'var(--brand-400)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="region-chip"><Icon name="globe" size={9} />{u.region}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.date}</span>
                {u.severity === 'high' && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber-700)', letterSpacing: '0.1em', marginLeft: 'auto' }}>
                    HIGH IMPACT
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, lineHeight: 1.35, marginBottom: 8 }}>{u.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                영향 제품군: <strong style={{ color: 'var(--text-primary)' }}>
                  {i === 0 ? 'RegenScan Pro, CardioMesh' : i === 1 ? 'NeuroTrack' : i === 2 ? '전체 IoT 제품' : 'SW 포함 전 제품'}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button className="btn btn-sm"><Icon name="sparkle" size={11} /> 영향도 분석</button>
                <button className="btn btn-sm btn-ghost"><Icon name="file" size={11} /> 원문 보기</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardView() {
  return (
    <div className="content">
      <div className="content-inner wide">
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>대시보드</h1>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 24 }}>2026년 4월 — 팀 활동 요약</p>

        <div className="stat-grid">
          {DATA.dashboardStats.map((s, i) => (
            <div key={i} className="stat">
              <div className="stat-label">{s.label}</div>
              <div className="stat-val">{s.val}</div>
              <div className={`stat-delta ${s.up ? 'up' : 'down'}`}>
                <Icon name={s.up ? 'up' : 'down'} size={10} /> {s.delta} vs 지난달
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">질의 유형별 분포</div>
              <button className="btn btn-sm btn-ghost"><Icon name="more" size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { l: '규제 해석 (Regulation Interpretation)', v: 82, c: 'var(--brand-600)' },
                { l: '허가 전략 (Submission Strategy)', v: 64, c: 'var(--amber-500)' },
                { l: '표준 매칭 (Standards Mapping)', v: 51, c: 'var(--success)' },
                { l: '임상/기술 문서 검토', v: 34, c: 'var(--brand-400)' },
                { l: 'FAQ / 단발성', v: 16, c: 'var(--ink-400)' },
              ].map((r, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{r.l}</span>
                    <span className="mono" style={{ color: 'var(--text-tertiary)' }}>{r.v}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${r.v}%`, height: '100%', background: r.c, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">규제 소스 커버리지</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {[
                { l: 'US FDA', v: '3,241 docs', dot: 'var(--brand-600)' },
                { l: 'EU Commission / MDCG', v: '1,867 docs', dot: 'var(--amber-500)' },
                { l: 'MFDS (KR)', v: '942 docs', dot: 'var(--success)' },
                { l: 'NMPA (CN)', v: '612 docs', dot: 'var(--brand-400)' },
                { l: 'PMDA (JP)', v: '488 docs', dot: 'var(--ink-500)' },
                { l: 'ISO / IEC', v: '2,104 standards', dot: 'var(--danger)' },
                { l: '사내 SOP / 이전 허가', v: '387 docs', dot: 'var(--brand-700)' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.dot }} />
                  <span style={{ flex: 1 }}>{r.l}</span>
                  <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><div className="card-title">팀 최근 활동</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { u: 'SJ', name: 'Seojin P.', act: '가 CardioMesh 프로젝트에 Predicate 비교표 생성을 요청했습니다', when: '12분 전' },
              { u: 'JH', name: 'Jiho L.', act: '가 NeuroTrack의 CER 체크리스트를 완료했습니다', when: '1시간 전' },
              { u: 'MY', name: 'Minyoung K.', act: '가 FDA AI/ML 가이던스 영향도 분석을 요청했습니다', when: '3시간 전' },
              { u: 'HR', name: 'Haeri J.', act: '가 RegenScan Pro의 GMP CAPA 기록을 업로드했습니다', when: '어제' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>{r.u}</div>
                <div style={{ flex: 1, fontSize: 13 }}><strong style={{ fontWeight: 500 }}>{r.name}</strong>{r.act}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourcesView() {
  const sources = [
    { group: '공식 규제 기관', items: [
      { name: 'US FDA', desc: 'CDRH guidance, 21 CFR, warning letters, 510(k) database', count: '3,241' },
      { name: 'EU Commission / MDCG', desc: 'MDR/IVDR, Annexes, MDCG guidance, MEDDEV', count: '1,867' },
      { name: 'MFDS (한국 식약처)', desc: '의료기기법, GMP, 기술문서 심사 가이드', count: '942' },
      { name: 'NMPA (중국)', desc: 'Medical Device Registration, Technical Requirements', count: '612' },
      { name: 'PMDA (일본)', desc: 'PMD Act, JIS standards, consultation records', count: '488' },
    ]},
    { group: '국제 표준', items: [
      { name: 'ISO / IEC / TC 210', desc: 'ISO 13485, 14971, IEC 60601, 62304, 62366', count: '2,104' },
      { name: 'AAMI', desc: 'TIR series, process standards', count: '327' },
    ]},
    { group: '사내 지식', items: [
      { name: 'SOP & Work Instructions', desc: '자사 품질경영시스템 전체 문서', count: '284' },
      { name: '이전 허가 자료', desc: '지난 7년 간 허가 이력 및 심사 피드백', count: '103' },
    ]},
  ];
  return (
    <div className="content">
      <div className="content-inner wide">
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>지식 베이스</h1>
        <p style={{ color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 24 }}>
          Regula가 참조하는 공식 및 사내 자료 — 매일 자동 동기화
        </p>

        {sources.map(g => (
          <div key={g.group} style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginTop: 0 }}>{g.group}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
              {g.items.map((s, i) => (
                <div key={i} className="card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--brand-50)', color: 'var(--brand-700)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="database" size={13} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.count}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>{s.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: 'var(--success)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                    Synced · 2분 전
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocViewer({ source, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 22, 40, 0.5)', zIndex: 300, display: 'flex', padding: 24 }}
      onClick={onClose}>
      <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-xl)', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="source-idx">{source.idx}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }} className="mono">{source.org} · {source.year}</div>
            <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.title}</div>
          </div>
          <button className="btn btn-sm"><Icon name="external" size={12} /> 원문</button>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="doc-viewer" style={{ flex: 1 }}>
          <div className="doc-nav">
            {['Article 61 Clinical Evaluation','— Para 1: General', '— Para 3: Update frequency','Article 83 PMS System','Article 84 PMS Plan','Article 85 PMS Report','Article 86 PSUR','Annex III: PMS','Annex XIV Clinical Evaluation'].map((t, i) => (
              <div key={i} className={`doc-nav-item ${t.startsWith('—') ? 'h2' : ''} ${i === 2 ? 'active' : ''}`}>{t}</div>
            ))}
          </div>
          <div className="doc-main">
            <div className="doc-header">
              <div className="doc-source-badge"><Icon name="shield" size={10} /> REGULATION (EU) 2017/745 · MDR</div>
              <div className="doc-title">Article 61 — Clinical evaluation and clinical investigations</div>
              <div className="doc-meta">
                <span>Official Journal L117</span>
                <span>Entered 2017-05-05</span>
                <span>Amended 2023-03-20</span>
              </div>
            </div>
            <div className="doc-body">
              <h2>Paragraph 3 — Update Frequency</h2>
              <p>
                <span className="highlight">The clinical evaluation and its documentation shall be updated throughout the life cycle of the device concerned with clinical data obtained from the implementation of the manufacturer's post-market surveillance plan</span> referred to in Article 84, and the post-market clinical follow-up plan referred to in Part B of Annex XIV.
              </p>
              <p>
                For class III devices and class IIb implantable devices, the PMCF evaluation report and, if applicable, the summary of safety and clinical performance referred to in Article 32 shall be updated at least annually with such data.
              </p>
              <h2>Cross-references</h2>
              <p>
                This article establishes the core feedback loop with <strong>Article 83 (Post-market surveillance system)</strong>, <strong>Article 84 (PMS Plan)</strong>, and <strong>Annex XIV Part B (PMCF)</strong>. Manufacturers must ensure bidirectional traceability between the CER and PMS documentation.
              </p>
              <h3>Practical Implementation</h3>
              <p>
                In practice, this means your Clinical Evaluation Plan (CEP) must explicitly reference the PMS data collection methods, and conversely, the PMS Plan must identify residual risks and open questions from the CER as specific objectives to monitor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.HistoryView = HistoryView;
window.TemplatesView = TemplatesView;
window.UpdatesView = UpdatesView;
window.DashboardView = DashboardView;
window.SourcesView = SourcesView;
window.DocViewer = DocViewer;
