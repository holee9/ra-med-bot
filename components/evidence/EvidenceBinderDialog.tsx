/**
 * Evidence Binder Dialog Component
 *
 * Dialog for creating evidence binders (collections of evidence links).
 * Provides form for binder metadata and requirement selection.
 *
 * @see Evidence API Integration Issue #168
 */

'use client';

import { useState } from 'react';
import { useCreateEvidenceBinder } from '@/lib/hooks/use-evidence-api';

interface EvidenceBinderDialogProps {
  availableReqIds: string[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EvidenceBinderDialog({
  availableReqIds,
  onSuccess,
  onCancel,
}: EvidenceBinderDialogProps) {
  const { createBinder, isLoading, error, data } = useCreateEvidenceBinder();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [templateType, setTemplateType] = useState<'regulatory' | 'technical' | 'quality'>('regulatory');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedReqIds.length === 0) {
      alert('최소 하나의 요구사항을 선택해주세요.');
      return;
    }

    try {
      await createBinder({
        name,
        description: description || undefined,
        req_ids: selectedReqIds,
        template_type: templateType,
      });

      if (data) {
        onSuccess?.();
      }
    } catch (err) {
      // Error is handled by the hook
      console.error('Failed to create evidence binder:', err);
    }
  };

  const toggleReqId = (reqId: string) => {
    setSelectedReqIds((prev) =>
      prev.includes(reqId)
        ? prev.filter((id) => id !== reqId)
        : [...prev, reqId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">증거 바인더 생성</h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                바인더 이름 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="증거 바인더 이름 입력"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명 (선택)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="바인더에 대한 설명 입력"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                템플릿 유형
              </label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="regulatory">규제 (Regulatory)</option>
                <option value="technical">기술 (Technical)</option>
                <option value="quality">품질 (Quality)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                포함할 요구사항 * ({selectedReqIds.length}개 선택됨)
              </label>
              <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto">
                {availableReqIds.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    선택 가능한 요구사항이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableReqIds.map((reqId) => (
                      <label
                        key={reqId}
                        className="flex items-center space-x-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedReqIds.includes(reqId)}
                          onChange={() => toggleReqId(reqId)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{reqId}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                선택된 요구사항: {selectedReqIds.length}개
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading || selectedReqIds.length === 0 || !name}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? '생성 중...' : '바인더 생성'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
