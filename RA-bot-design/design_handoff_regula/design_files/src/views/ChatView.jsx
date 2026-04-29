// Chat / Answer view — the heart of the product
function ComposerBar({ value, onChange, onSubmit, streaming }) {
  const [model, setModel] = useState('pro');
  const [focus, setFocus] = useState('all');
  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          rows={1}
          placeholder="의료기기 규제 관련 질문을 입력하세요… (예: Class IIb 제품의 Notified Body 변경 절차)"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
        />
        <div className="composer-actions">
          <button className={`chip ${focus === 'all' ? 'active' : ''}`} onClick={() => setFocus('all')}>
            <Icon name="globe" size={11} /> 전체 소스
          </button>
          <button className={`chip ${focus === 'regs' ? 'active' : ''}`} onClick={() => setFocus('regs')}>
            <Icon name="shield" size={11} /> 규제만
          </button>
          <button className={`chip ${focus === 'internal' ? 'active' : ''}`} onClick={() => setFocus('internal')}>
            <Icon name="folder" size={11} /> 사내 SOP
          </button>
          <button className="chip"><Icon name="upload" size={11} /> 파일 첨부</button>
          <button className="submit-btn" onClick={onSubmit} disabled={streaming || !value.trim()}>
            <Icon name={streaming ? 'loader' : 'send'} size={15} />
          </button>
        </div>
      </div>
      <div className="composer-foot">
        <span>Shift + Enter 줄바꿈 · Enter 전송</span>
        <span className="mono">model: regula-ra-v2.3 · pro</span>
      </div>
    </div>
  );
}

function Thinking({ trace }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= trace.length) return;
    const t = setTimeout(() => setShown(s => s + 1), 700);
    return () => clearTimeout(t);
  }, [shown, trace.length]);

  return (
    <div className="trace">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 500 }}>
        <Icon name="sparkle" size={14} /> 분석 중
        <span className="thinking-dots"><span/><span/><span/></span>
      </div>
      {trace.slice(0, shown + 1).map((s, i) => (
        <div key={i} className={`trace-step ${i < shown ? 'done' : 'active'}`}>
          <Icon name={i < shown ? 'check' : 'loader'} size={13} />
          {s.step}
        </div>
      ))}
    </div>
  );
}

function ConfidenceBadge({ level, score }) {
  const labels = { high: '높은 신뢰도', med: '보통 신뢰도', low: '검토 필요' };
  return (
    <span className={`confidence ${level}`}>
      <span className="confidence-dot" />
      {labels[level]} · {score}%
    </span>
  );
}

function SourceCard({ s, onOpen }) {
  const typeColor = {
    Regulation: 'var(--brand-600)',
    Guidance: 'var(--amber-600)',
    Standard: 'var(--success)',
    Industry: 'var(--ink-600)',
    Internal: 'var(--brand-700)',
  }[s.type] || 'var(--ink-600)';
  return (
    <div className="source-card" onClick={onOpen}>
      <div className="source-head">
        <span className="source-idx">{s.idx}</span>
        <span className="source-org">{s.org.toUpperCase()}</span>
        <span style={{ marginLeft: 'auto', color: typeColor, fontWeight: 600, fontSize: 10, letterSpacing: '0.04em' }}>
          {s.type.toUpperCase()}
        </span>
      </div>
      <div className="source-title">{s.title}</div>
      <div className="source-foot">
        <span className="mono">{s.year}</span>
        <Icon name="external" size={11} />
      </div>
    </div>
  );
}

function AnswerBlock({ data, onOpenSource }) {
  const [checks, setChecks] = useState(data.checklist.reduce((a,c) => ({...a,[c.id]:c.done}), {}));
  return (
    <div className="answer-block">
      <div className="answer-meta">
        <ConfidenceBadge level={data.confidence} score={data.confidenceScore} />
        <span className="meta-item"><Icon name="book" size={12} /><strong>{data.sources}</strong> 출처</span>
        <span className="meta-item"><Icon name="clock" size={12} />분석 <strong>{data.duration}</strong></span>
        <span className="meta-item" style={{ marginLeft: 'auto' }}>
          <button className="icon-btn" title="복사"><Icon name="copy" size={13} /></button>
          <button className="icon-btn" title="다운로드"><Icon name="download" size={13} /></button>
          <button className="icon-btn" title="좋음"><Icon name="thumbup" size={13} /></button>
          <button className="icon-btn" title="재생성"><Icon name="refresh" size={13} /></button>
        </span>
      </div>

      <div className="callout expert">
        <Icon name="alert" size={15} className="callout-icon" />
        <div className="callout-body">
          <strong>전문가 검토 권장</strong>
          임상 평가와 시판 후 감시의 연계는 Notified Body 감사에서 deficiency 다발 영역입니다. 최종 제출 전 사내 RA 리드의 승인을 권장합니다.
        </div>
      </div>

      <div className="section-label">요약 답변</div>
      <div className="answer-prose" dangerouslySetInnerHTML={{ __html: data.summary }} />

      <div className="section-label">핵심 체크리스트 <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto', letterSpacing: 0, textTransform: 'none', fontSize: 11 }}>
        {Object.values(checks).filter(Boolean).length} / {data.checklist.length} 완료
      </span></div>
      <div className="checklist">
        {data.checklist.map(c => (
          <div key={c.id} className={`check-row ${checks[c.id] ? 'done' : ''}`} onClick={() => setChecks({...checks, [c.id]: !checks[c.id]})}>
            <div className="check-box">{checks[c.id] && <Icon name="check" size={11} stroke={3} />}</div>
            <div style={{ flex: 1 }}>
              <div className="check-label">{c.title}</div>
              <div className="check-meta">
                <span className="tag">{c.ref}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">{data.comparison.title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="cmp-table">
          <thead><tr>{data.comparison.cols.map((c, i) => (
            <th key={i}>{i === 0 ? c : <span className="region-chip"><Icon name="globe" size={9} />{c}</span>}</th>
          ))}</tr></thead>
          <tbody>
            {data.comparison.rows.map((r, i) => (
              <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-label">실행 타임라인</div>
      <div className="timeline" style={{ marginBottom: 24 }}>
        {data.timeline.map((t, i) => (
          <div key={i} className={`tl-row ${t.current ? 'current' : ''}`}>
            <div className="tl-date mono">{t.date}</div>
            <div className="tl-title">{t.title}</div>
            <div className="tl-desc">{t.desc}</div>
          </div>
        ))}
      </div>

      <div className="section-label">출처 ({data.sourceList.length})</div>
      <div className="sources-grid">
        {data.sourceList.map(s => <SourceCard key={s.idx} s={s} onOpen={() => onOpenSource(s)} />)}
      </div>

      <div className="section-label">이어서 질문하기</div>
      <div className="suggest">
        {data.related.map((r, i) => (
          <button key={i} className="suggest-pill">
            <Icon name="plus" size={11} /> {r}
          </button>
        ))}
      </div>
    </div>
  );
}

function RightContext({ data, onOpenSource }) {
  return (
    <aside className="right-panel">
      <div className="right-section">
        <div className="right-title">현재 프로젝트</div>
        <div style={{ padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--bg-surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="project-dot" style={{ background: '#0f7a4d' }} />
            <div style={{ fontWeight: 500, fontSize: 13 }}>NeuroTrack EU MDR</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Class IIb · NB 2797 · Submission 2026-Q3</div>
        </div>
      </div>

      <div className="right-section">
        <div className="right-title">활용 출처</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.sourceList.slice(0, 5).map(s => (
            <div key={s.idx} onClick={() => onOpenSource(s)} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'flex-start', transition: 'background 120ms' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span className="source-idx">{s.idx}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.org} · {s.year}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="right-section">
        <div className="right-title">관련 규제 업데이트</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DATA.updates.slice(0, 3).map((u, i) => (
            <div key={i} style={{ fontSize: 12, padding: 8, borderLeft: `2px solid ${u.severity === 'high' ? 'var(--amber-500)' : 'var(--brand-300)'}`, paddingLeft: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }} className="mono">{u.date} · {u.region}</div>
              <div style={{ lineHeight: 1.35 }}>{u.title}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function ChatView({ query, setQuery, messages, streaming, onSubmit, onOpenSource }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  return (
    <div className="split">
      <div className="main" style={{ height: '100%' }}>
        <div className="content" ref={scrollRef}>
          <div className="content-inner">
            {messages.length === 0 ? (
              <div className="hero" style={{ paddingTop: 120 }}>
                <h1 style={{ fontSize: 36 }}>새로운 <span className="accent">상담</span></h1>
                <p className="hero-sub">규제 문서, 표준, 사내 자료를 교차 분석합니다.</p>
              </div>
            ) : messages.map((m, i) => (
              <div key={i}>
                <div className="msg-user">{m.question}</div>
                {streaming && i === messages.length - 1 ? (
                  <Thinking trace={m.trace} />
                ) : (
                  <AnswerBlock data={m} onOpenSource={onOpenSource} />
                )}
              </div>
            ))}
          </div>
          <ComposerBar value={query} onChange={setQuery} onSubmit={onSubmit} streaming={streaming} />
        </div>
      </div>
      {messages.length > 0 && !streaming && (
        <RightContext data={messages[messages.length - 1]} onOpenSource={onOpenSource} />
      )}
    </div>
  );
}

window.ChatView = ChatView;
