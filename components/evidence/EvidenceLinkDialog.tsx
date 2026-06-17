/**
 * Evidence Link Dialog Component
 *
 * Dialog for creating requirement-evidence links.
 * Provides form for selecting evidence sources and linking to requirements.
 *
 * @see Evidence API Integration Issue #168
 */

'use client';

import { useState } from 'react';
import { useCreateEvidenceLink } from '@/lib/hooks/use-evidence-api';

interface EvidenceSource {
  source_type: 'regulation' | 'standard' | 'guidance' | 'internal';
  source_id: string;
  title: string;
  url?: string;
}

interface EvidenceLinkDialogProps {
  reqId: string;
  requirementText: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EvidenceLinkDialog({
  reqId,
  requirementText,
  onSuccess,
  onCancel,
}: EvidenceLinkDialogProps) {
  const { createLink, isLoading, error, data } = useCreateEvidenceLink();
  const [sources, setSources] = useState<EvidenceSource[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createLink({
        req_id: reqId,
        requirement_text: requirementText,
        evidence_sources: sources,
      });

      if (data) {
        onSuccess?.();
      }
    } catch (err) {
      // Error is handled by the hook
      console.error('Failed to create evidence link:', err);
    }
  };

  const addSource = () => {
    setSources([
      ...sources,
      {
        source_type: 'regulation',
        source_id: '',
        title: '',
      },
    ]);
  };

  const updateSource = (index: number, field: keyof EvidenceSource, value: string) => {
    const updated = [...sources];
    updated[index] = { ...updated[index], [field]: value };
    setSources(updated);
  };

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">증거 링크 생성</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              요구사항 ID
            </label>
            <input
              type="text"
              value={reqId}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              요구사항 내용
            </label>
            <textarea
              value={requirementText}
              disabled
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                증거 소스
              </label>
              <button
                type="button"
                onClick={addSource}
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                + 소스 추가
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">증거 소스를 추가해주세요.</p>
            ) : (
              <div className="space-y-3">
                {sources.map((source, index) => (
                  <div key={index} className="border border-gray-300 rounded-md p-4">
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          소스 유형
                        </label>
                        <select
                          value={source.source_type}
                          onChange={(e) =>
                            updateSource(index, 'source_type', e.target.value as any)
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded-md"
                        >
                          <option value="regulation">규정</option>
                          <option value="standard">표준</option>
                          <option value="guidance">가이드라인</option>
                          <option value="internal">내부 문서</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          소스 ID
                        </label>
                        <input
                          type="text"
                          value={source.source_id}
                          onChange={(e) => updateSource(index, 'source_id', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md"
                          placeholder="소스 ID 입력"
                        />
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        제목
                      </label>
                      <input
                        type="text"
                        value={source.title}
                        onChange={(e) => updateSource(index, 'title', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md"
                        placeholder="증거 제목 입력"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        URL (선택)
                      </label>
                      <input
                        type="url"
                        value={source.url || ''}
                        onChange={(e) => updateSource(index, 'url', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md"
                        placeholder="https://example.com"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSource(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || sources.length === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? '생성 중...' : '링크 생성'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
