// @MX:NOTE: Server Component per REQ-CHAT-058. Interactive logic delegated to ChatShell.
// @MX:SPEC: SPEC-REGULA-CHAT-001 (REQ-CHAT-031..039, REQ-CHAT-051..052, REQ-CHAT-058)

import { ChatShell } from '../../../components/chat/ChatShell';

export default function ChatPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-content flex-col px-4 pb-4 pt-6">
      {/* Empty state — rendered server-side so it is always in the initial HTML */}
      <section className="flex flex-1 flex-col items-center justify-center text-center py-16">
        <h1 className="font-serif text-3xl text-brand-800">새로운 상담을 시작하세요</h1>
        <p className="mt-4 text-ink-600">규제 질문을 입력하면 출처와 함께 답변해 드립니다.</p>
      </section>

      {/* Client shell owns all interactive state */}
      <ChatShell />
    </div>
  );
}
