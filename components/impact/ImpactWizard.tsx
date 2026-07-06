'use client';

import {
  type ImpactCheckRequest,
  type ImpactCheckResponse,
  useImpactCheck,
} from '@/lib/queries/useImpactCheck';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Step1Product } from './Step1Product';
import { Step2Category } from './Step2Category';
import { Step3Detail } from './Step3Detail';
import { Step4Markets } from './Step4Markets';
import { ImpactResult } from './result/ImpactResult';

interface ImpactWizardProps {
  orgId: string;
}

export function ImpactWizard({ orgId }: ImpactWizardProps) {
  const t = useTranslations('impact');
  const mutation = useImpactCheck();

  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState('');
  const [changeType, setChangeType] = useState('');
  const [changeDetail, setChangeDetail] = useState('');
  const [markets, setMarkets] = useState<string[]>([]);

  const handleSubmit = (event?: React.MouseEvent | React.KeyboardEvent) => {
    // @MX:NOTE AC-IMP-UI-06 duplicate-submit prevention — guard even if the submit button is somehow clickable during pending.
    if (mutation.isPending) return;

    // Edge 9: keyboard navigation - prevent double-submit on Enter key
    if (event && event.type === 'keydown') {
      const keyboardEvent = event as React.KeyboardEvent;
      if (keyboardEvent.key === 'Enter' && keyboardEvent.repeat) {
        return;
      }
    }

    mutation.mutate(
      {
        orgId,
        productId,
        changeType: changeType as ImpactCheckRequest['changeType'],
        markets: markets as ImpactCheckRequest['markets'],
        changeDetail,
      },
      {
        onSuccess: (_data: ImpactCheckResponse) => {
          // Result will be shown in success state
          setStep(5); // Result step
        },
      },
    );
  };

  const handleReset = () => {
    mutation.reset();
  };

  // Loading state (M4)
  if (mutation.isPending) {
    return (
      <div data-testid="loading-state" className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('result.loadingMessage')}</p>
        </div>
      </div>
    );
  }

  // Error states (M4)
  if (mutation.isError) {
    const error = mutation.error as { status?: number; message?: string };

    // 403 Forbidden (Edge Case 4)
    if (error.status === 403) {
      return (
        <div data-testid="error-state" className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="text-red-600 text-6xl mb-4">⛔</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('error.forbidden')}</h2>
            <p className="text-gray-600">{t('error.forbiddenDesc')}</p>
          </div>
        </div>
      );
    }

    // 400 Bad Request - show backend error message
    if (error.status === 400) {
      return (
        <div data-testid="error-state" className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('error.badRequest')}</h2>
            <p className="text-gray-600">{error.message || t('error.badRequestDesc')}</p>
          </div>
        </div>
      );
    }

    // Network error or 500 (Edge Case 7)
    return (
      <div data-testid="error-state" className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-orange-600 text-6xl mb-4">🔄</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('error.network')}</h2>
          <p className="text-gray-600 mb-4">{t('error.networkDesc')}</p>
          <button
            type="button"
            onClick={handleReset}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-label={t('button.retry')}
          >
            {t('button.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Result state (M5 Phase 2 - full result page)
  if (step === 5 && mutation.data) {
    const data = mutation.data;
    return <ImpactResult data={data} />;
  }

  // Step navigation
  const onNext = () => setStep((s) => s + 1);
  const onBack = () => setStep((s) => s - 1);

  return (
    <div className="max-w-2xl mx-auto p-6">
      {step === 1 && (
        <Step1Product onNext={onNext} productId={productId} setProductId={setProductId} />
      )}

      {step === 2 && (
        <Step2Category onNext={onNext} changeType={changeType} setChangeType={setChangeType} />
      )}

      {step === 3 && (
        <Step3Detail
          onNext={onNext}
          changeDetail={changeDetail}
          setChangeDetail={setChangeDetail}
        />
      )}

      {step === 4 && (
        <Step4Markets
          onSubmit={handleSubmit}
          onBack={onBack}
          markets={markets}
          setMarkets={setMarkets}
        />
      )}

      {step > 1 && step < 4 && (
        <button
          type="button"
          data-testid="impact-back-button"
          onClick={onBack}
          className="mt-4 rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
          aria-label={t('button.back')}
        >
          {t('button.back')}
        </button>
      )}
    </div>
  );
}
