import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Export - Regula',
  description: 'Regula export functionality documentation',
};

export default function ExportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Export 기능</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">개요</h2>
        <p className="mb-4">
          Regula는 다양한 포맷으로 아티팩트를 내보내는 기능을 제공합니다. 현재
          지원되는 포맷은 다음과 같습니다:
        </p>
        <ul className="list-disc pl-6 mb-4">
          <li><strong>Markdown</strong>: 복사/붙여넣기용 텍스트 포맷</li>
          <li><strong>DOCX</strong>: Microsoft Word 문서</li>
          <li><strong>PDF</strong>: 인쇄용 PDF 문서</li>
          <li><strong>Email</strong>: 이메일 전송 (mailto 링크)</li>
        </ul>
        <p className="text-sm text-gray-600">
          이 기능은 SPEC-REGULA-EXPORT-HUB-001 (#87)로 구현되었습니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">지원되는 포맷</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-medium mb-2">Markdown</h3>
            <p className="mb-2">
              Markdown 포맷은 일반 텍스트 편집기에서 바로 사용할 수 있는 형식입니다.
              인용 출처가 하이퍼링크로 포함됩니다.
            </p>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              <li>섹션 헤더 변환 (h1 → #, h2 → ##, h3 → ###)</li>
              <li>인용 출처 포맷팅 ([text](url))</li>
              <li>단락 구조 유지</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-2">DOCX</h3>
            <p className="mb-2">
              Microsoft Word 호환 문서를 생성합니다. 인용 출처가 클릭 가능한
              하이퍼링크로 포함됩니다.
            </p>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              <li>Word 스타일 (Heading1, Heading2, Heading3)</li>
              <li>인용 하이퍼링크 (밑줄, 파란색)</li>
              <li>문서 메타데이터 (제목, 작성자, 생성일)</li>
              <li>Regula 브랜딩</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-2">PDF</h3>
            <p className="mb-2">
              인쇄용 PDF 문서를 생성합니다. A4 페이지 사이즈를 사용합니다.
            </p>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              <li>Regula 헤더 (모든 페이지)</li>
              <li>페이지 번호 (푸터)</li>
              <li>내용 레이아웃 및 페이지 나눔기</li>
              <li>인쇄 최적화 스타일링</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-2">Email</h3>
            <p className="mb-2">
              기본 이메일 클라이언트를 열어 이메일을 전송할 수 있는 mailto 링크를
              생성합니다.
            </p>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              <li>미리 채워진 제목 줄</li>
              <li>포맷된 본문</li>
              <li>인용 출처 포함</li>
            </ul>
            <p className="text-sm text-yellow-600 mt-2">
              ⚠️ 브라우저 보안 제약으로 인해 파일 첨부는 지원되지 않습니다. DOCX
              또는 PDF로 먼저 내보낸 후 이메일 클라이언트에서 첨부해주세요.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">사용법</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">1. Export 버튼 클릭</h3>
            <p className="text-gray-700">
              답변, 체크리스트, 비교표 컴포넌트의 메타데이터 영역에 있는 Export
              버튼(📄 아이콘)을 클릭합니다.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">2. 포맷 선택</h3>
            <p className="text-gray-700">
              드롭다운 메뉴에서 원하는 포맷을 선택합니다:
            </p>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              <li><strong>DOCX (다운로드)</strong>: Word 문서 다운로드</li>
              <li><strong>PDF (인쇄용)</strong>: PDF 문서 다운로드</li>
              <li><strong>Markdown (복사/붙여넣기)</strong>: 클립보드에 복사</li>
              <li><strong>Email (이메일 전달)</strong>: 이메일 클라이언트 열기</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">3. 내보내기</h3>
            <p className="text-gray-700">
              선택한 포맷에 따라 파일이 다운로드되거나, 클립보드에 복사되거나,
              이메일 클라이언트가 열립니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">감사 로깅</h2>
        <p className="text-gray-700 mb-4">
          모든 내보내기 작업은 21 CFR Part 11 준수를 위해 감사 로그에 기록됩니다.
          기록되는 정보:
        </p>
        <ul className="list-disc pl-6 text-sm text-gray-700">
          <li>아티팩트 타입 (answer, checklist, comparison)</li>
          <li>내보내기 포맷 (docx, pdf, markdown, email)</li>
          <li>타임스탬프</li>
          <li>사용자 ID</li>
        </ul>
        <p className="text-sm text-gray-600">
          감사 로그는 audit_logs 테이블의 append-only 구조로 저장됩니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">제한 사항</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Email 포맷</h3>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              <li>최대 URL 길이 제약 (일반적으로 2000자)</li>
              <li>이메일 클라이언트가 긴 본문을 잘릴 수 있음</li>
              <li>파일 첨부 불가 (브라우저 보안 제약)</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">PDF 포맷</h3>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              <li>한글 폰트 지원 (시스템 폰트 사용)</li>
              <li>복잡한 테이블 레이아웃은 단순화될 수 있음</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">기술 스택</h2>
        <ul className="list-disc pl-6 text-sm text-gray-700">
          <li>DOCX: docx ^9.7.1</li>
          <li>PDF: @react-pdf/renderer ^4.5.1</li>
          <li>Markdown: react-markdown ^9.0.1</li>
          <li>Testing: Vitest, React Testing Library, Playwright</li>
        </ul>
      </section>
    </div>
  );
}
