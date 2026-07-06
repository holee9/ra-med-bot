import { useTranslations } from 'next-intl';

const CHANGE_TYPES = ['bom', 'sw', 'sw-minor', 'label', 'warn', 'process', 'sterile'] as const;

interface Step2CategoryProps {
  onNext: () => void;
  changeType: string;
  setChangeType: (value: string) => void;
}

export function Step2Category({ onNext, changeType, setChangeType }: Step2CategoryProps) {
  const t = useTranslations('impact');

  return (
    <div data-testid="step2-category" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('wizard.step2.title')}</h2>
      <p className="text-sm text-gray-600">{t('wizard.step2.description')}</p>

      <div className="space-y-2">
        {CHANGE_TYPES.map((cat) => (
          <div key={cat} className="flex items-start gap-3">
            <input
              id={`category-${cat}`}
              data-testid={`category-${cat}`}
              type="radio"
              name="changeType"
              value={cat}
              checked={changeType === cat}
              onChange={(e) => setChangeType(e.target.value)}
              className="mt-1"
            />
            <label htmlFor={`category-${cat}`} className="flex-1 cursor-pointer">
              <div className="font-medium">{t(`categories.${cat}.label`)}</div>
              {changeType === cat && (
                <div data-testid="category-description" className="text-sm text-gray-600">
                  {t(`categories.${cat}.description`)}
                </div>
              )}
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        data-testid="impact-next-button"
        onClick={onNext}
        disabled={!changeType}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={t('button.next')}
      >
        {t('button.next')}
      </button>
    </div>
  );
}
