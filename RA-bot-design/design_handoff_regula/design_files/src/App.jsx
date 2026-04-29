// Main App entry
const { useState: useS, useEffect: useE, useMemo: useM } = React;

const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "lang": "ko",
  "density": "default",
  "demo": true
}/*EDITMODE-END*/;

function App() {
  const [view, setView] = useS(() => localStorage.getItem('regula_view') || 'home');
  const [tweaks, setTweaks] = useS(TWEAK_DEFAULS);
  const [tweaksOn, setTweaksOn] = useS(false);
  const [onboarding, setOnboarding] = useS(() => !localStorage.getItem('regula_onboarded'));
  const [query, setQuery] = useS('');
  const [messages, setMessages] = useS([]);
  const [streaming, setStreaming] = useS(false);
  const [openSource, setOpenSource] = useS(null);

  useE(() => { document.documentElement.setAttribute('data-theme', tweaks.theme); }, [tweaks.theme]);
  useE(() => { localStorage.setItem('regula_view', view); }, [view]);

  // Edit mode protocol
  useE(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOn(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateTweak = (patch) => {
    setTweaks(t => ({ ...t, ...patch }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  };

  const finishOnboarding = () => {
    localStorage.setItem('regula_onboarded', '1');
    setOnboarding(false);
  };

  const handleAsk = (q) => {
    const text = typeof q === 'string' ? q : query;
    if (!text.trim()) return;
    setView('chat');
    setQuery('');
    const newMsg = {
      question: text,
      trace: DATA.sampleAnswer.trace,
      ...DATA.sampleAnswer,
    };
    setMessages(m => [...m, newMsg]);
    setStreaming(true);
    setTimeout(() => setStreaming(false), 3200);
  };

  const crumbs = useM(() => {
    const map = {
      home: ['Workspace', 'Home'],
      chat: ['Workspace', 'New Consultation'],
      history: ['Workspace', 'History'],
      templates: ['Workspace', 'Templates'],
      sources: ['Workspace', 'Knowledge Base'],
      updates: ['Workspace', 'Regulatory Updates'],
      dashboard: ['Workspace', 'Dashboard'],
    };
    return map[view] || ['Workspace'];
  }, [view]);

  const newConsultation = () => {
    setMessages([]);
    setQuery('');
    setView('chat');
  };

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} onNew={newConsultation} />
      <div className="main">
        <Topbar crumbs={crumbs} theme={tweaks.theme} setTheme={(t) => updateTweak({ theme: t })} />
        {view === 'home' && <HomeView onAsk={handleAsk} onPickTemplate={() => setView('templates')} />}
        {view === 'chat' && <ChatView query={query} setQuery={setQuery} messages={messages} streaming={streaming} onSubmit={() => handleAsk(query)} onOpenSource={setOpenSource} />}
        {view === 'history' && <HistoryView onOpen={handleAsk} />}
        {view === 'templates' && <TemplatesView />}
        {view === 'sources' && <SourcesView />}
        {view === 'updates' && <UpdatesView />}
        {view === 'dashboard' && <DashboardView />}
      </div>
      {openSource && <DocViewer source={openSource} onClose={() => setOpenSource(null)} />}
      {onboarding && <Onboarding onDone={finishOnboarding} />}
      {tweaksOn && <TweaksPanel values={tweaks} onChange={updateTweak} onClose={() => setTweaksOn(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
