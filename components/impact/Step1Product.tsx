import { useTranslations } from 'next-intl';

interface Step1ProductProps {
  onNext: () => void;
  productId: string;
  setProductId: (value: string) => void;
}

export function Step1Product({ onNext, productId, setProductId }: Step1ProductProps) {
  const t = useTranslations('impact');

  return (
    <div data-testid="step1-product" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('wizard.step1.title')}</h2>
      <p className="text-sm text-gray-600">{t('wizard.step1.description')}</p>

      <div>
        <label htmlFor="impact-product-input" className="block text-sm font-medium">
          {t('form.productId.label')}
        </label>
        <input
          id="impact-product-input"
          data-testid="impact-product-input"
          type="text"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder={t('form.productId.placeholder')}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <button
        type="button"
        data-testid="impact-next-button"
        onClick={onNext}
        disabled={productId.length < 1}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={t('button.next')}
      >
        {t('button.next')}
      </button>
    </div>
  );
}
