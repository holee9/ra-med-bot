// Home / Hero — first entry screen
function HomeView({ onAsk, onPickTemplate }) {
  const quicks = [
    { icon: 'bolt', title: '510(k) 제출 가이드', desc: 'Predicate 선정부터 FDA Q-Sub까지', q: 'Class II 의료기기 510(k) 제출 프로세스와 주요 일정을 정리해줘' },
    { icon: 'shield', title: 'EU MDR 전환 체크', desc: 'Legacy device MDR 대응', q: 'MDD에서 MDR로 전환할 때 technical documentation gap analysis 항목은?' },
    { icon: 'globe', title: '다국가 허가 비교', desc: 'FDA / CE / MFDS / NMPA', q: '동일 Class II 제품을 미국·유럽·한국·중국에 동시 허가할 때 전략' },
    { icon: 'workflow', title: '규제 변경 영향도', desc: '최근 발행된 가이던스 분석', q: 'FDA의 AI/ML SaMD Predetermined Change Control 최종 지침이 기존 제품에 미치는 영향' },
  ];
  return (
    <div className="content">
      <div className="content-inner">
        <div className="hero">
          <div className="hero-eyebrow">
            <span className="pulse" />
            최신 규제 데이터 <span className="mono" style={{ opacity: 0.7 }}>· 2026-04-22 기준</span>
          </div>
          <h1>무엇을 <span className="accent">검토</span>해 드릴까요?</h1>
          <p className="hero-sub">
            의료기기 규제 문서·표준·사내 자료를 교차 분석하여 근거 기반의 솔루션을 제공합니다.
            질문하거나, 아래에서 자주 쓰는 시나리오를 선택하세요.
          </p>
          <div className="quick-grid">
            {quicks.map((q, i) => (
              <div key={i} className="quick-card" onClick={() => onAsk(q.q)}>
                <div className="quick-card-icon"><Icon name={q.icon} size={14} /></div>
                <div className="quick-card-title">{q.title}</div>
                <div className="quick-card-desc">{q.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-label">최근 질의</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {DATA.history.slice(0, 4).map(h => (
            <div key={h.id} className="nav-item" style={{ padding: '10px 14px', margin: 0, borderRadius: 8 }} onClick={() => onAsk(h.q)}>
              <Icon name="message" size={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.q}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {h.project} · {h.when} · {h.citations} citations
                </div>
              </div>
              <Icon name="right" size={13} />
            </div>
          ))}
        </div>

        <div className="section-label">빠른 템플릿</div>
        <div className="tpl-grid">
          {DATA.templates.slice(0, 3).map(t => (
            <div key={t.id} className="tpl-card" onClick={onPickTemplate}>
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

window.HomeView = HomeView;
