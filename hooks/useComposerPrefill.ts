// @MX:NOTE useComposerPrefill — SuggestionPill prefill hook.
// Provides text state + prefill() + clear() for Composer textarea injection.
// Phase 3: state-only. Phase 4 will connect to actual textarea ref.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-027)

import { useCallback, useState } from 'react';

interface ComposerPrefillState {
  text: string;
  prefill: (text: string) => void;
  clear: () => void;
}

export function useComposerPrefill(): ComposerPrefillState {
  const [text, setText] = useState('');

  const prefill = useCallback((value: string) => {
    setText(value);
  }, []);

  const clear = useCallback(() => {
    setText('');
  }, []);

  return { text, prefill, clear };
}
