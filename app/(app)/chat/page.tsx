// @MX:NOTE Chat empty state — REQ-FND-017. Real composer/answer pipeline
// arrives in Phase 2; this scaffolds the /chat route with the Korean prompt.

export default function ChatPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-content flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="font-serif text-3xl text-brand-800">새로운 상담을 시작하세요</h1>
      <p className="mt-4 text-ink-600">규제 질문을 입력하면 출처와 함께 답변해 드립니다.</p>
    </section>
  );
}
