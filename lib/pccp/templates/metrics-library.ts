// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-003)
// Performance metric definitions for SPS population

export interface PerformanceMetricDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  typical_threshold_range: { min: number; max: number };
  applicable_tasks: string[];
}

export const PERFORMANCE_METRICS_LIBRARY: PerformanceMetricDefinition[] = [
  {
    id: 'sensitivity',
    name: 'Sensitivity (Recall)',
    description: 'True positive rate — proportion of actual positives correctly identified.',
    unit: '%',
    typical_threshold_range: { min: 80, max: 99 },
    applicable_tasks: ['classification', 'detection', 'segmentation'],
  },
  {
    id: 'specificity',
    name: 'Specificity',
    description: 'True negative rate — proportion of actual negatives correctly identified.',
    unit: '%',
    typical_threshold_range: { min: 80, max: 99 },
    applicable_tasks: ['classification', 'detection'],
  },
  {
    id: 'auc',
    name: 'AUC-ROC',
    description: 'Area Under the Receiver Operating Characteristic Curve.',
    unit: 'score (0-1)',
    typical_threshold_range: { min: 0.8, max: 1.0 },
    applicable_tasks: ['classification'],
  },
  {
    id: 'ppv',
    name: 'Positive Predictive Value (Precision)',
    description: 'Proportion of positive predictions that are correct.',
    unit: '%',
    typical_threshold_range: { min: 75, max: 99 },
    applicable_tasks: ['classification', 'detection'],
  },
  {
    id: 'npv',
    name: 'Negative Predictive Value',
    description: 'Proportion of negative predictions that are correct.',
    unit: '%',
    typical_threshold_range: { min: 75, max: 99 },
    applicable_tasks: ['classification'],
  },
  {
    id: 'dice',
    name: 'Dice Similarity Coefficient',
    description: 'Overlap measure for segmentation tasks.',
    unit: 'score (0-1)',
    typical_threshold_range: { min: 0.7, max: 1.0 },
    applicable_tasks: ['segmentation'],
  },
  {
    id: 'f1',
    name: 'F1 Score',
    description: 'Harmonic mean of precision and recall.',
    unit: 'score (0-1)',
    typical_threshold_range: { min: 0.75, max: 1.0 },
    applicable_tasks: ['classification', 'detection'],
  },
  {
    id: 'mae',
    name: 'Mean Absolute Error',
    description: 'Average absolute difference between predicted and actual values.',
    unit: 'domain-specific',
    typical_threshold_range: { min: 0, max: 10 },
    applicable_tasks: ['regression', 'measurement'],
  },
  {
    id: 'froc',
    name: 'Free-Response ROC (FROC)',
    description: 'Sensitivity vs. false positives per image for detection tasks.',
    unit: 'sensitivity at X FP/image',
    typical_threshold_range: { min: 0.7, max: 1.0 },
    applicable_tasks: ['detection'],
  },
  {
    id: 'calibration_ece',
    name: 'Expected Calibration Error (ECE)',
    description: 'Measures reliability of probability estimates.',
    unit: 'score (0-1, lower better)',
    typical_threshold_range: { min: 0, max: 0.1 },
    applicable_tasks: ['classification'],
  },
];

export function getMetricById(id: string): PerformanceMetricDefinition | undefined {
  return PERFORMANCE_METRICS_LIBRARY.find((m) => m.id === id);
}
