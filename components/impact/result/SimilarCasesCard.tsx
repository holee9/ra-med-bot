import { useTranslations } from 'next-intl';

export interface SimilarCase {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

interface SimilarCasesCardProps {
  similarCases?: Array<SimilarCase>;
}

export function SimilarCasesCard({ similarCases }: SimilarCasesCardProps) {
  const t = useTranslations('impact');

  if (similarCases === undefined) {
    return (
      <div data-testid="similar-cases" className="space-y-4">
        <h3 className="text-lg font-semibold">{t('result.similarHeader')}</h3>
        <p className="text-sm text-gray-600">{t('result.similarCasesSkipped')}</p>
      </div>
    );
  }

  if (similarCases.length === 0) {
    return (
      <div data-testid="similar-cases" className="space-y-4">
        <h3 className="text-lg font-semibold">{t('result.similarHeader')}</h3>
        <p className="text-sm text-gray-600">{t('result.noSimilarCases')}</p>
      </div>
    );
  }

  return (
    <div data-testid="similar-cases" className="space-y-4">
      <h3 className="text-lg font-semibold">{t('result.similarHeader')}</h3>
      <div className="space-y-3">
        {similarCases.map((item, index) => (
          <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-sm mb-1">
              {item.title}
              <sup className="cite text-xs text-blue-600 ml-1" data-src={item.id}>
                {index + 1}
              </sup>
            </h4>
            <p className="text-sm text-gray-700">{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
