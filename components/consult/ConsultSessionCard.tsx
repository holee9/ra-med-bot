'use client';

// @MX:NOTE ConsultSessionCard — REQ-V3-UI-051. Session card without turnCount.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-051)
import Link from 'next/link';

interface ConsultSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ConsultSessionCardProps {
  session: ConsultSession;
}

export default function ConsultSessionCard({ session }: ConsultSessionCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Link href={`/consult/${session.id}`}>
      <div className="border border-ink-200 rounded-lg p-4 hover:bg-ink-50 transition-colors cursor-pointer">
        <h3 className="font-medium text-ink-900 truncate">{session.title}</h3>
        <div className="mt-2 text-xs text-ink-500">
          <div>생성: {formatDate(session.createdAt)}</div>
          <div>수정: {formatDate(session.updatedAt)}</div>
        </div>
      </div>
    </Link>
  );
}
