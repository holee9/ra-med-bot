import { useTranslations } from 'next-intl';

const MARKETS = ['us', 'eu', 'kr', 'cn', 'jp'] as const;

interface Step4MarketsProps {
  onSubmit: () => void;
  onBack?: () => void;
  markets: string[];
  setMarkets: (value: string[]) => void;
}

export function Step4Markets({ onSubmit, onBack, markets, setMarkets }: Step4MarketsProps) {
  const t = useTranslations('impact');

  const handleMarketToggle = (market: string) => {
    if (markets.includes(market)) {
      setMarkets(markets.filter((m) => m !== market));
    } else {
      setMarkets([...markets, market]);
    }
  };

  return (
    <div data-testid="step4-markets" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('wizard.step4.title')}</h2>
      <p className="text-sm text-gray-600">{t('wizard.step4.description')}</p>

      <div className="space-y-2">
        {MARKETS.map((market) => (
          <div key={market} className="flex items-center gap-3">
            <input
              id={`market-${market}`}
              data-testid={`market-${market}`}
              type="checkbox"
              checked={markets.includes(market)}
              onChange={() => handleMarketToggle(market)}
              className="h-4 w-4"
            />
            <label htmlFor={`market-${market}`} className="cursor-pointer">
              <div className="font-medium">{t(`markets.${market}.label`)}</div>
              <div className="text-sm text-gray-600">{t(`markets.${market}.description`)}</div>
            </label>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {onBack && (
          <button
            type="button"
            data-testid="impact-back-button"
            onClick={onBack}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
            aria-label={t('button.back')}
          >
            {t('button.back')}
          </button>
        )}

        <button
          type="button"
          data-testid="impact-submit-button"
          onClick={onSubmit}
          disabled={markets.length < 1}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          aria-label={t('button.startEvaluation')}
        >
          {t('button.startEvaluation')}
        </button>
      </div>
    </div>
  );
}
