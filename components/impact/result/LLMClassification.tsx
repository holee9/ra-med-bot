import { useTranslations } from 'next-intl';

interface ClassificationProps {
  classification: {
    category: string;
    confidence: number;
    reason: string;
  };
}

export function LLMClassification({ classification }: ClassificationProps) {
  const t = useTranslations('impact');
  const confidencePercent = (classification.confidence * 100).toFixed(0);
  const isLowConfidence = classification.confidence < 0.8;

  return (
    <div data-testid="llm-classification" className="space-y-4">
      <h3 className="text-lg font-semibold">{t('result.llmHeader')}</h3>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-sm text-gray-600">{t('result.category')}</span>
            <p className="font-semibold capitalize">{classification.category}</p>
          </div>

          <div>
            <span className="text-sm text-gray-600">{t('result.confidence')}</span>
            <p className="font-semibold">{confidencePercent}%</p>
          </div>

          <div>
            <span className="text-sm text-gray-600">{t('result.reason')}</span>
            <p className="text-sm">{classification.reason}</p>
          </div>
        </div>

        {isLowConfidence && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              {t('result.lowConfidenceBadge')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
