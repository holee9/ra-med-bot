import { useTranslations } from 'next-intl';

interface Step3DetailProps {
  onNext: () => void;
  changeDetail: string;
  setChangeDetail: (value: string) => void;
}

const MIN_CHARS = 10;
const MAX_CHARS = 2000;

export function Step3Detail({ onNext, changeDetail, setChangeDetail }: Step3DetailProps) {
  const t = useTranslations('impact');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Block input beyond MAX_CHARS
    if (newValue.length > MAX_CHARS) {
      return;
    }
    setChangeDetail(newValue);
  };

  const isValid = changeDetail.length >= MIN_CHARS && changeDetail.length <= MAX_CHARS;
  const isError = changeDetail.length > 0 && changeDetail.length < MIN_CHARS;
  const isEmptyError = changeDetail.length === 0;
  const isMaxError = changeDetail.length > MAX_CHARS;

  return (
    <div data-testid="step3-detail" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('wizard.step3.title')}</h2>
      <p className="text-sm text-gray-600">{t('wizard.step3.description')}</p>

      <div>
        <label htmlFor="impact-detail-textarea" className="block text-sm font-medium">
          {t('form.changeDetail.label')}
        </label>
        <textarea
          id="impact-detail-textarea"
          data-testid="impact-detail-textarea"
          value={changeDetail}
          onChange={handleChange}
          placeholder={t('form.changeDetail.placeholder')}
          rows={6}
          className="w-full rounded border px-3 py-2"
        />
        <div data-testid="char-counter" className="mt-1 text-xs text-gray-500">
          {t('form.changeDetail.counter', { current: changeDetail.length })}
        </div>
      </div>

      {/* Error messages */}
      {isEmptyError && (
        <div data-testid="impact-error-message" className="text-sm text-red-600">
          {t('form.changeDetail.charMinError')}
        </div>
      )}

      {isError && (
        <div data-testid="impact-error-message" className="text-sm text-red-600">
          {t('form.changeDetail.charMinError')}
        </div>
      )}

      {isMaxError && (
        <div data-testid="impact-error-message" className="text-sm text-red-600">
          {t('form.changeDetail.charMaxError')}
        </div>
      )}

      <button
        type="button"
        data-testid="impact-next-button"
        onClick={onNext}
        disabled={!isValid}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={t('button.next')}
      >
        {t('button.next')}
      </button>
    </div>
  );
}
