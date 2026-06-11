'use client';

// @MX:NOTE [AUTO] RefinePanel — inline answer refinement with tone presets.
// Shown as an overlay on AnswerBlock prose when user clicks "Refine".
// @MX:SPEC SPEC-REGULA-ANSWER-REFINE-001 (REQ-ANSWER-REFINE-001..002)

import { Wand2 } from 'lucide-react';
import { useState } from 'react';

type Tone = 'conservative' | 'regulatory-strict' | 'executive-summary' | 'technical-detail';

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  {
    value: 'conservative',
    label: '보수적 / 안전 우선',
    description: '규제 리스크 최소화, 신중한 표현 사용',
  },
  {
    value: 'regulatory-strict',
    label: '규제 엄격',
    description: 'FDA·EU MDR 조항 인용 강화, 정확한 법률 용어 사용',
  },
  {
    value: 'executive-summary',
    label: '경영 요약',
    description: '핵심 결론 우선, 기술 세부사항 제거',
  },
  { value: 'technical-detail', label: '기술 상세', description: '구현 가이드·표준 요건 전면 포함' },
];

interface RefinePanelProps {
  messageId: string;
  conversationId: string;
  prose: string;
  onRefined: (refined: string, tone: Tone) => void;
}

export function RefinePanel({ messageId, conversationId, prose, onRefined }: RefinePanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customNote, setCustomNote] = useState('');

  async function handleRefine(tone: Tone) {
    setLoading(true);
    try {
      const res = await fetch('/api/ra/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, conversationId, blockContent: prose, tone, customNote }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { refined: string; tone: string };
      onRefined(data.refined, tone);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        data-testid="refine-btn"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1 text-xs text-ink-500 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50"
      >
        <Wand2 size={12} />
        {loading ? '정제 중…' : '답변 정제'}
      </button>

      {open && !loading && (
        <div
          data-testid="refine-popover"
          className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-border-weak bg-white shadow-lg"
        >
          <p className="border-b border-border-weak px-4 py-2 text-xs font-semibold text-ink-700">
            톤 프리셋 선택
          </p>
          <ul className="p-2">
            {TONE_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  data-testid={`tone-option-${opt.value}`}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-brand-50 transition-colors"
                  onClick={() => void handleRefine(opt.value)}
                >
                  <span className="block font-medium text-ink-800">{opt.label}</span>
                  <span className="text-ink-400">{opt.description}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border-weak px-4 py-2">
            <input
              type="text"
              data-testid="refine-custom-note"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="추가 지시사항 (선택)"
              className="w-full rounded border border-border-weak px-2 py-1 text-xs placeholder:text-ink-400 focus:border-brand-300 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
