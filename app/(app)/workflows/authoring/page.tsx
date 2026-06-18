import { AuthoringWorkspace } from './_components/authoring-workspace';

export default function AuthoringPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">섹션 초안 작성</h1>
        <p className="text-gray-600 mt-2">
          섹션 초안 작성 세션을 생성하고 승인/반려 처리합니다.
        </p>
      </div>

      <AuthoringWorkspace />
    </div>
  );
}
