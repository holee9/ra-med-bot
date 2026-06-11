// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-002)
// FDA AI/ML Final Guidance 2024-04 — 4 modification categories

import type { ModificationType } from '../types';

export interface ModificationTypeDefinition {
  id: ModificationType;
  label: string;
  description: string;
  examples: string[];
  requiresNewClearance: boolean;
}

export const MODIFICATION_TYPE_DEFINITIONS: Record<ModificationType, ModificationTypeDefinition> = {
  performance_improvement: {
    id: 'performance_improvement',
    label: 'Performance Improvement',
    description:
      'Modifications that improve algorithm performance metrics within the same intended use.',
    examples: [
      'Improved AUC from 0.85 to 0.92 on the same task',
      'Reduced false negative rate on existing indication',
      'Enhanced robustness to imaging artifact',
    ],
    requiresNewClearance: false,
  },
  new_intended_use: {
    id: 'new_intended_use',
    label: 'New Intended Use',
    description:
      'Modifications that expand or change the clinical indication or target population.',
    examples: [
      'Extending from adult to pediatric population',
      'Adding a new anatomical site',
      'Changing from screening to diagnostic use',
    ],
    requiresNewClearance: true,
  },
  input_output_change: {
    id: 'input_output_change',
    label: 'Input / Output Change',
    description: 'Modifications to input data modality, resolution, or output format/type.',
    examples: [
      'Adding a new imaging modality (e.g., MRI → CT)',
      'Changing output from binary to probabilistic score',
      'Expanding input from 2D to 3D imaging',
    ],
    requiresNewClearance: false,
  },
  algorithm_change: {
    id: 'algorithm_change',
    label: 'Algorithm Architecture Change',
    description: 'Modifications to model architecture, training methodology, or core algorithm.',
    examples: [
      'Switching from CNN to transformer architecture',
      'Changing loss function or training objective',
      'Adding continual learning capability',
    ],
    requiresNewClearance: false,
  },
};
