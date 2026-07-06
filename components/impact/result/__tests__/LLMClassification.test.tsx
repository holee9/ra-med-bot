/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LLMClassification } from '../LLMClassification';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('LLMClassification', () => {
  describe('AC-IMP-UI-08: renders classification data', () => {
    it('should render category, confidence as percentage, and reason', () => {
      const classification = {
        category: 'bom',
        confidence: 0.85,
        reason: 'SoC 교체는 BOM 패턴',
      };

      render(<LLMClassification classification={classification} />);

      expect(screen.getByText('bom')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('SoC 교체는 BOM 패턴')).toBeInTheDocument();
    });

    it('should convert confidence float to percentage', () => {
      const classification = {
        category: 'sw',
        confidence: 0.75,
        reason: 'Firmware update',
      };

      render(<LLMClassification classification={classification} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should handle confidence boundary at 0.80 (Edge Case 4b)', () => {
      const classification = {
        category: 'label',
        confidence: 0.8,
        reason: 'Label change',
      };

      render(<LLMClassification classification={classification} />);

      expect(screen.getByText('80%')).toBeInTheDocument();
      // Should NOT show low confidence warning (>= 0.8)
      expect(screen.queryByText('result.lowConfidenceBadge')).not.toBeInTheDocument();
    });

    it('should show low confidence badge when confidence < 0.8', () => {
      const classification = {
        category: 'process',
        confidence: 0.65,
        reason: 'Process change',
      };

      render(<LLMClassification classification={classification} />);

      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('result.lowConfidenceBadge')).toBeInTheDocument();
    });

    it('should have testid for LLM classification', () => {
      const classification = {
        category: 'warn',
        confidence: 0.9,
        reason: 'Warning update',
      };

      render(<LLMClassification classification={classification} />);

      const component = screen.getByTestId('llm-classification');
      expect(component).toBeInTheDocument();
    });
  });

  describe('Edge cases and formatting', () => {
    it('should round confidence to nearest integer', () => {
      const classification = {
        category: 'sterile',
        confidence: 0.856,
        reason: 'Sterile maintenance',
      };

      render(<LLMClassification classification={classification} />);

      expect(screen.getByText('86%')).toBeInTheDocument();
    });

    it('should handle confidence of 1.0', () => {
      const classification = {
        category: 'bom',
        confidence: 1.0,
        reason: 'Complete match',
      };

      render(<LLMClassification classification={classification} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle confidence of 0.0', () => {
      const classification = {
        category: 'sw-minor',
        confidence: 0.0,
        reason: 'No match',
      };

      render(<LLMClassification classification={classification} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('result.lowConfidenceBadge')).toBeInTheDocument();
    });
  });
});
