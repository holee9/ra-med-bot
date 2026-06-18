'use client';

import { useState } from 'react';
import { useCreateAuthoringSession, useAuthoringSession, useApproveSession, useRejectSession } from '@/lib/queries/useAuthoring';
import type { SessionRequest, ApprovalRequest } from '@/lib/api/authoring-client';

export function AuthoringWorkspace() {
  const createSession = useCreateAuthoringSession();
  const approveSession = useApproveSession();
  const rejectSession = useRejectSession();

  const [sessionForm, setSessionForm] = useState<SessionRequest>({
    section_id: '',
    device_id: '',
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [approvalForm, setApprovalForm] = useState<ApprovalRequest>({
    decision: 'approve',
    comments: '',
  });

  const { data: session } = useAuthoringSession(currentSessionId || '');

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createSession.mutateAsync(sessionForm);
      setCurrentSessionId(result.session_id);
      setSessionForm({ section_id: '', device_id: '' });
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSessionId) return;

    try {
      await approveSession.mutateAsync({
        sessionId: currentSessionId,
        request: approvalForm,
      });
      setCurrentSessionId(null);
      setApprovalForm({ decision: 'approve', comments: '' });
    } catch (err) {
      console.error('Failed to approve session:', err);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSessionId) return;

    try {
      await rejectSession.mutateAsync({
        sessionId: currentSessionId,
        request: approvalForm,
      });
      setCurrentSessionId(null);
      setApprovalForm({ decision: 'approve', comments: '' });
    } catch (err) {
      console.error('Failed to reject session:', err);
    }
  };

  return (
    <div className="space-y-8">
      {!currentSessionId ? (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">섹션 초안 작성 세션 생성</h2>
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                섹션 ID
              </label>
              <input
                type="text"
                value={sessionForm.section_id}
                onChange={(e) => setSessionForm({ ...sessionForm, section_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기기 ID
              </label>
              <input
                type="text"
                value={sessionForm.device_id}
                onChange={(e) => setSessionForm({ ...sessionForm, device_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>

            <button
              type="submit"
              disabled={createSession.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createSession.isPending ? '처리 중...' : '세션 생성'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">세션 상태 및 초안</h2>
              <button
                onClick={() => setCurrentSessionId(null)}
                className="text-sm text-gray-600 hover:underline"
              >
                닫기
              </button>
            </div>

            {session && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">세션 ID</p>
                    <p className="font-medium">{session.session_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">상태</p>
                    <span className={`px-2 py-1 text-xs rounded ${
                      session.status === 'approved' ? 'bg-green-100 text-green-800' :
                      session.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      session.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">현재 초안</p>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <p className="whitespace-pre-wrap">{session.current_draft || '초안 없음'}</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  생성: {new Date(session.created_at).toLocaleString()}
                  {session.updated_at && ` | 업데이트: ${new Date(session.updated_at).toLocaleString()}`}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">승인/반려</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  결정
                </label>
                <select
                  value={approvalForm.decision}
                  onChange={(e) => setApprovalForm({ ...approvalForm, decision: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-md p-2"
                >
                  <option value="approve">승인</option>
                  <option value="reject">반려</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  코멘트
                </label>
                <textarea
                  value={approvalForm.comments}
                  onChange={(e) => setApprovalForm({ ...approvalForm, comments: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2"
                  rows={3}
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleApprove}
                  disabled={approveSession.isPending || approvalForm.decision !== 'approve'}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {approveSession.isPending ? '처리 중...' : '승인'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejectSession.isPending || approvalForm.decision !== 'reject'}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectSession.isPending ? '처리 중...' : '반려'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
