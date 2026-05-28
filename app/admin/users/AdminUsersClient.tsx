'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
};

const STATUS_LABEL: Record<string, string> = {
  pending: '승인 대기',
  active: '활성',
  disabled: '비활성',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-yellow-700 bg-yellow-50',
  active: 'text-green-700 bg-green-50',
  disabled: 'text-ink-400 bg-ink-50',
};

export default function AdminUsersClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(id: string, status: 'active' | 'pending' | 'disabled') {
    setLoading(id);
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    router.refresh();
  }

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  return (
    <div className="mt-6 flex flex-col gap-8">
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">승인 대기 ({pending.length})</h2>
          <div className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {pending.map((u) => (
              <Row key={u.id} user={u} loading={loading} onUpdate={updateStatus} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-700">전체 사용자</h2>
          <div className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {others.map((u) => (
              <Row key={u.id} user={u} loading={loading} onUpdate={updateStatus} />
            ))}
          </div>
        </section>
      )}

      {users.length === 0 && <p className="text-sm text-ink-400">등록된 사용자가 없습니다.</p>}
    </div>
  );
}

function Row({
  user,
  loading,
  onUpdate,
}: {
  user: User;
  loading: string | null;
  onUpdate: (id: string, status: 'active' | 'pending' | 'disabled') => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-800">{user.name}</p>
        <p className="text-xs text-ink-500">{user.email}</p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[user.status] ?? ''}`}
        >
          {STATUS_LABEL[user.status] ?? user.status}
        </span>
        {user.status === 'pending' && (
          <button
            onClick={() => onUpdate(user.id, 'active')}
            disabled={loading === user.id}
            className="rounded bg-brand-700 px-3 py-1 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            승인
          </button>
        )}
        {user.status === 'active' && (
          <button
            onClick={() => onUpdate(user.id, 'disabled')}
            disabled={loading === user.id}
            className="rounded border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-50"
          >
            비활성
          </button>
        )}
        {user.status === 'disabled' && (
          <button
            onClick={() => onUpdate(user.id, 'active')}
            disabled={loading === user.id}
            className="rounded border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 disabled:opacity-50"
          >
            재활성
          </button>
        )}
      </div>
    </div>
  );
}
