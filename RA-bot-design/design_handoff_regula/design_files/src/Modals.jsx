// Onboarding modal and Tweaks panel
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      eyebrow: '환영합니다',
      title: '의료기기 RA, 더 이상 혼자 고민하지 마세요',
      body: 'Regula는 FDA · EU MDR · MFDS · NMPA · ISO/IEC 등 공식 규제 문서와 사내 SOP를 교차 분석해, 근거 기반의 답변을 제공합니다.',
      icon: 'shield',
    },
    {
      eyebrow: '출처 중심',
      title: '모든 답변에 근거를 남깁니다',
      body: '모든 문장에는 공식 규제 조항이나 내부 문서에 대한 인라인 인용이 포함됩니다. 클릭 한 번으로 원문 확인.',
      icon: 'book',
    },
    {
      eyebrow: '당신 팀의 문맥',
      title: '프로젝트별 맞춤 답변',
      body: '사내 SOP, 이전 허가 자료, 현재 프로젝트 상태를 반영해 "당신의 제품에 적용되는" 답변을 제공합니다.',
      icon: 'folder',
    },
    {
      eyebrow: '안전 장치',
      title: '전문가 검토가 필요한 순간, 알려드립니다',
      body: '신뢰도가 낮거나 해석의 여지가 있는 영역은 자동으로 "전문가 검토 권장" 배지가 표시됩니다.',
      icon: 'alert',
    },
  ];
  const s = steps[step];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 400, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 520, maxWidth: '100%', background: 'var(--bg-surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, margin: '0 auto 20px', background: 'linear-gradient(135deg, var(--brand-800), var(--brand-600))', color: 'white', display: 'grid', placeItems: 'center' }}>
            <Icon name={s.icon} size={26} stroke={1.5} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--brand-700)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>{s.eyebrow}</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, lineHeight: 1.25, marginBottom: 12, letterSpacing: '-0.01em' }}>{s.title}</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 400, margin: '0 auto' }}>{s.body}</div>
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {steps.map((_, i) => (
              <span key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? 'var(--brand-600)' : 'var(--border-default)', transition: 'all 200ms' }} />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm" onClick={onDone}>건너뛰기</button>
          <button className="btn btn-primary btn-sm" onClick={() => step < steps.length - 1 ? setStep(step + 1) : onDone()}>
            {step < steps.length - 1 ? '다음' : '시작하기'} <Icon name="right" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TweaksPanel({ values, onChange, onClose }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        Tweaks
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose}><Icon name="close" size={12} /></button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <label>테마</label>
          <div className="seg">
            <button className={values.theme === 'light' ? 'on' : ''} onClick={() => onChange({ theme: 'light' })}>Light</button>
            <button className={values.theme === 'dark' ? 'on' : ''} onClick={() => onChange({ theme: 'dark' })}>Dark</button>
          </div>
        </div>
        <div className="tweak-row">
          <label>언어</label>
          <div className="seg">
            <button className={values.lang === 'ko' ? 'on' : ''} onClick={() => onChange({ lang: 'ko' })}>한/영</button>
            <button className={values.lang === 'en' ? 'on' : ''} onClick={() => onChange({ lang: 'en' })}>EN</button>
          </div>
        </div>
        <div className="tweak-row">
          <label>답변 밀도</label>
          <div className="seg">
            <button className={values.density === 'compact' ? 'on' : ''} onClick={() => onChange({ density: 'compact' })}>Compact</button>
            <button className={values.density === 'default' ? 'on' : ''} onClick={() => onChange({ density: 'default' })}>Default</button>
          </div>
        </div>
        <div className="tweak-row">
          <label>시연 모드</label>
          <div className="seg">
            <button className={values.demo ? 'on' : ''} onClick={() => onChange({ demo: true })}>On</button>
            <button className={!values.demo ? 'on' : ''} onClick={() => onChange({ demo: false })}>Off</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;
window.TweaksPanel = TweaksPanel;
