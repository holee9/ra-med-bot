import { EvidenceForm } from './_components/evidence-form';

export default function EvidencePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">증거 관리</h1>
        <p className="text-gray-600 mt-2">
          요구사항과 증거를 연결하고 바인더를 생성합니다.
        </p>
      </div>

      <EvidenceForm />
    </div>
  );
}
