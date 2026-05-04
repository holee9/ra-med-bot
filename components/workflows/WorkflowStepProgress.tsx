// @MX:NOTE [AUTO] WorkflowStepProgress — step-by-step progress indicator for workflow runs.
// Each step can be 'completed', 'current', or 'pending'.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (M6)

export type StepState = 'completed' | 'current' | 'pending';

// @MX:ANCHOR [AUTO] getStepState — exported pure function used by WorkflowStepProgress and tests.
// @MX:REASON Public API boundary; used by component render and unit tests.
export function getStepState(
  step: string,
  currentStep: string | null,
  completedSteps: string[],
): StepState {
  if (completedSteps.includes(step)) return 'completed';
  if (step === currentStep) return 'current';
  return 'pending';
}

interface WorkflowStepProgressProps {
  steps: string[];
  currentStep: string | null;
  completedSteps: string[];
}

export function WorkflowStepProgress({
  steps,
  currentStep,
  completedSteps,
}: WorkflowStepProgressProps) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step) => {
        const state = getStepState(step, currentStep, completedSteps);
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-label={state}
              className={[
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs',
                state === 'completed' && 'border-green-500 bg-green-500 text-white',
                state === 'current' && 'border-brand-500 bg-brand-50 text-brand-700',
                state === 'pending' && 'border-ink-300 bg-surface text-ink-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {state === 'completed' ? '✓' : state === 'current' ? '●' : '○'}
            </span>
            <span
              className={[
                'text-sm',
                state === 'completed' && 'text-ink-500 line-through',
                state === 'current' && 'font-medium text-ink-900',
                state === 'pending' && 'text-ink-400',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
