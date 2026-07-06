import { useTranslations } from 'next-intl';

interface SignalLightProps {
  signal: 'green' | 'yellow' | 'red';
}

export function SignalLight({ signal }: SignalLightProps) {
  const t = useTranslations('impact');

  const signalColorMap = {
    green: 'var(--color-signal-green)',
    yellow: 'var(--color-signal-yellow)',
    red: 'var(--color-signal-red)',
  } as const;

  const signalLabel = t(`result.signalLabel.${signal}`);

  return (
    <output
      data-testid="signal-light"
      className={`signal-${signal} px-6 py-4 rounded font-semibold uppercase inline-block min-w-[120px] text-center text-white`}
      style={{
        backgroundColor: signalColorMap[signal],
      }}
      aria-label={signalLabel}
    >
      {signalLabel}
    </output>
  );
}
