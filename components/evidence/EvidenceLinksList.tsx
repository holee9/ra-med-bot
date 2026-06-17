/**
 * Evidence Links List Component
 *
 * Displays evidence links for a specific requirement.
 * Shows loading state, error handling, and empty state.
 *
 * @see Evidence API Integration Issue #168
 */

'use client';

import { useEffect } from 'react';
import { useEvidenceLinks } from '@/lib/hooks/use-evidence-api';

interface EvidenceLinksListProps {
  reqId: string | null;
}

export function EvidenceLinksList({ reqId }: EvidenceLinksListProps) {
  const { fetchLinks, isLoading, error, data } = useEvidenceLinks(reqId);

  useEffect(() => {
    if (reqId) {
      fetchLinks();
    }
  }, [reqId, fetchLinks]);

  if (!reqId) {
    return (
      <div className="text-gray-500 text-sm py-4">
        요구사항을 선택해주세요.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={fetchLinks}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data || data.links.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4">
        등록된 증거 링크가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          증거 링크 ({data.total}개)
        </h3>
        <span className="text-sm text-gray-500">
          요구사항 ID: {reqId}
        </span>
      </div>

      <div className="space-y-2">
        {data.links.map((link) => (
          <div
            key={link.id}
            className="border border-gray-300 rounded-md p-4 hover:bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-gray-900">{link.id}</h4>
              <span className="text-xs text-gray-500">
                {new Date(link.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>

            <p className="text-sm text-gray-700 mb-3">
              {link.requirement_text}
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">증거 소스:</p>
              {link.evidence_sources.map((source, index) => (
                <div key={index} className="pl-4 border-l-2 border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                      {source.source_type}
                    </span>
                    <span className="text-sm font-medium">{source.title}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span>ID: {source.source_id}</span>
                    {source.url && (
                      <>
                        {' | '}
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          링크
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
