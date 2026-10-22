// @MX:NOTE [AUTO] 홈 — 2026-10-20 scope purge #2: the Phase-4 role-entry card
// page (links to deleted orphan views) is replaced by a redirect to 채팅.
// @MX:REASON 필수 기능만 남기는 스코프 퍼지 — 질의·응답이 곧 홈.

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/chat');
}
