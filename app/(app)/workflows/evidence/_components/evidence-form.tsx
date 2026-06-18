'use client';

import type { BinderRequest, LinkRequest } from '@/lib/api/evidence-client';
import {
  useCreateBinder,
  useCreateEvidenceLink,
  useEvidenceLinks,
} from '@/lib/queries/useEvidence';
import { useState } from 'react';

type EvidenceType = LinkRequest['evidence_type'];

export function EvidenceForm() {
  const createLink = useCreateEvidenceLink();
  const createBinder = useCreateBinder();

  const [linkForm, setLinkForm] = useState<LinkRequest>({
    requirement_id: '',
    evidence_type: 'clinical',
    description: '',
  });

  const [binderForm, setBinderForm] = useState<BinderRequest>({
    name: '',
    link_ids: [],
  });

  const [currentReqId, setCurrentReqId] = useState<string | null>(null);
  const { data: links } = useEvidenceLinks(currentReqId || '');

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createLink.mutateAsync(linkForm);
      setCurrentReqId(result.req_id);
      setLinkForm({ requirement_id: '', evidence_type: 'clinical', description: '' });
    } catch (err) {
      console.error('Failed to create link:', err);
    }
  };

  const handleCreateBinder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBinder.mutateAsync(binderForm);
      setBinderForm({ name: '', link_ids: [] });
      setCurrentReqId(null);
    } catch (err) {
      console.error('Failed to create binder:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">요구사항-증거 링크 생성</h2>
        <form onSubmit={handleCreateLink} className="space-y-4">
          <div>
            <label
              htmlFor="evidence-requirement-id"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              요구사항 ID
            </label>
            <input
              id="evidence-requirement-id"
              type="text"
              value={linkForm.requirement_id}
              onChange={(e) => setLinkForm({ ...linkForm, requirement_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>

          <div>
            <label htmlFor="evidence-type" className="block text-sm font-medium text-gray-700 mb-1">
              증거 유형
            </label>
            <select
              id="evidence-type"
              value={linkForm.evidence_type}
              onChange={(e) =>
                setLinkForm({ ...linkForm, evidence_type: e.target.value as EvidenceType })
              }
              className="w-full border border-gray-300 rounded-md p-2"
            >
              <option value="clinical">임상</option>
              <option value="preclinical">비임상</option>
              <option value="technical">기술</option>
              <option value="labeling">라벨링</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="evidence-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              설명
            </label>
            <textarea
              id="evidence-description"
              value={linkForm.description}
              onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md p-2"
              rows={3}
              required
            />
          </div>

          <button
            type="submit"
            disabled={createLink.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {createLink.isPending ? '처리 중...' : '링크 생성'}
          </button>
        </form>
      </div>

      {links && links.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">링크 목록 ({links.length})</h3>
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.req_id} className="border border-gray-200 rounded-md p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{link.evidence_type}</p>
                    <p className="text-sm text-gray-600">{link.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      생성: {new Date(link.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      link.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : link.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {link.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {links && links.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">증거 바인더 생성</h2>
          <form onSubmit={handleCreateBinder} className="space-y-4">
            <div>
              <label
                htmlFor="evidence-binder-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                바인더 이름
              </label>
              <input
                id="evidence-binder-name"
                type="text"
                value={binderForm.name}
                onChange={(e) => setBinderForm({ ...binderForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() =>
                  setBinderForm({
                    ...binderForm,
                    link_ids: links.map((l) => l.req_id),
                  })
                }
                className="text-sm text-blue-600 hover:underline"
              >
                모든 링크 포함
              </button>
              <span className="text-sm text-gray-500">({binderForm.link_ids.length}개 선택됨)</span>
            </div>

            <button
              type="submit"
              disabled={createBinder.isPending}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {createBinder.isPending ? '처리 중...' : '바인더 생성'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
