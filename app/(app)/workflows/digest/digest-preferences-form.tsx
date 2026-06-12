'use client';
// @MX:SPEC SPEC-REGULA-DIGEST-001
import { useState } from 'react';

interface DigestPrefs {
  frequency: string;
  timezone: string;
  sendDayOfWeek: number;
  sendHour: number;
  minSeverity: string;
  includeImmediateAlerts: boolean;
  recipientEmails: string[];
}

interface Props {
  orgId: string;
  initialPrefs: DigestPrefs;
}

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const FREQUENCIES = [
  { value: 'weekly', label: '매주' },
  { value: 'biweekly', label: '격주' },
  { value: 'manual', label: '수동 발송' },
  { value: 'disabled', label: '비활성화' },
];
const SEVERITIES = [
  { value: 'low', label: '낮음 이상 (전체)' },
  { value: 'medium', label: '중간 이상' },
  { value: 'high', label: '높음 이상' },
  { value: 'critical', label: '긴급만' },
];

export default function DigestPreferencesForm({ orgId, initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<DigestPrefs>(initialPrefs);
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ra/digest/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prefs, orgId }),
      });
      if (!res.ok) throw new Error('저장 실패');
      setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateNow() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ra/digest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: prefs.recipientEmails.length > 0 }),
      });
      if (!res.ok) throw new Error('생성 실패');
      const data = await res.json();
      setMessage({
        type: 'success',
        text: `다이제스트 생성 완료: ${(data.digest as DigestPrefs & { update_count?: number }).update_count ?? 0}개 업데이트`,
      });
    } catch {
      setMessage({ type: 'error', text: '다이제스트 생성 중 오류가 발생했습니다.' });
    } finally {
      setGenerating(false);
    }
  }

  function addEmail() {
    const email = emailInput.trim();
    if (email && !prefs.recipientEmails.includes(email)) {
      setPrefs((p) => ({ ...p, recipientEmails: [...p.recipientEmails, email] }));
      setEmailInput('');
    }
  }

  function removeEmail(email: string) {
    setPrefs((p) => ({ ...p, recipientEmails: p.recipientEmails.filter((e) => e !== email) }));
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
      {message && (
        <div
          className={`text-sm px-4 py-2 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">발송 빈도</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          value={prefs.frequency}
          onChange={(e) => setPrefs((p) => ({ ...p, frequency: e.target.value }))}
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">발송 요일</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={prefs.sendDayOfWeek}
            onChange={(e) => setPrefs((p) => ({ ...p, sendDayOfWeek: Number(e.target.value) }))}
          >
            {DAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">발송 시각 (시)</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            value={prefs.sendHour}
            onChange={(e) => setPrefs((p) => ({ ...p, sendHour: Number(e.target.value) }))}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">최소 심각도</label>
        <select
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          value={prefs.minSeverity}
          onChange={(e) => setPrefs((p) => ({ ...p, minSeverity: e.target.value }))}
        >
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">수신 이메일</label>
        <div className="flex gap-2 mb-2">
          <input
            type="email"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="이메일 주소 입력"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEmail();
              }
            }}
          />
          <button
            type="button"
            onClick={addEmail}
            className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
          >
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {prefs.recipientEmails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
            >
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleGenerateNow}
          disabled={generating}
          className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {generating ? '생성 중...' : '지금 다이제스트 생성'}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </form>
  );
}
