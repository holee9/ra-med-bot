/**
 * Evidence Management Page
 *
 * Main page for Evidence API integration.
 * Provides UI for creating evidence links, viewing links, and creating binders.
 *
 * @see Evidence API Integration Issue #168
 */

'use client';

import { useState } from 'react';
import { EvidenceLinkDialog } from '@/components/evidence/EvidenceLinkDialog';
import { EvidenceLinksList } from '@/components/evidence/EvidenceLinksList';
import { EvidenceBinderDialog } from '@/components/evidence/EvidenceBinderDialog';

export default function EvidencePage() {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showBinderDialog, setShowBinderDialog] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);

  // Sample requirement IDs (in real app, this would come from your requirements database)
  const availableReqIds = [
    'REQ-001',
    'REQ-002',
    'REQ-003',
    'REQ-004',
    'REQ-005',
  ];

  const sampleRequirementText = '의료기기 안전성 평가를 위한 임상 데이터 제출';

  const handleOpenLinkDialog = (reqId: string) => {
    setSelectedReqId(reqId);
    setShowLinkDialog(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          증거 관리
        </h1>
        <p className="text-gray-600">
          요구사항과 증거를 연결하고 증거 바인더를 생성합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Actions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">빠른 작업</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleOpenLinkDialog('REQ-001')}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
              >
                새 증거 링크 생성
              </button>
              <button
                onClick={() => setShowBinderDialog(true)}
                className="w-full px-4 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
              >
                증거 바인더 생성
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">요구사항 목록</h2>
            <div className="space-y-2">
              {availableReqIds.map((reqId) => (
                <button
                  key={reqId}
                  onClick={() => setSelectedReqId(reqId)}
                  className={`w-full text-left px-3 py-2 rounded-md transition ${
                    selectedReqId === reqId
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {reqId}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Evidence Links */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {selectedReqId ? `증거 링크 - ${selectedReqId}` : '증거 링크'}
              </h2>
              {selectedReqId && (
                <button
                  onClick={() => handleOpenLinkDialog(selectedReqId)}
                  className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                >
                  + 링크 추가
                </button>
              )}
            </div>

            <EvidenceLinksList reqId={selectedReqId} />

            {!selectedReqId && (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="mt-2">요구사항을 선택하여 증거 링크를 확인하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showLinkDialog && selectedReqId && (
        <EvidenceLinkDialog
          reqId={selectedReqId}
          requirementText={sampleRequirementText}
          onSuccess={() => {
            setShowLinkDialog(false);
            // Refresh the list
            window.location.reload();
          }}
          onCancel={() => setShowLinkDialog(false)}
        />
      )}

      {showBinderDialog && (
        <EvidenceBinderDialog
          availableReqIds={availableReqIds}
          onSuccess={() => {
            setShowBinderDialog(false);
            alert('증거 바인더가 생성되었습니다.');
          }}
          onCancel={() => setShowBinderDialog(false)}
        />
      )}
    </div>
  );
}
