/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignalLight } from '../SignalLight';

// Mock next-intl (consult test pattern)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('SignalLight', () => {
  describe('AC-IMP-UI-07: renders signal from backend data', () => {
    it('should render green signal with correct styling', () => {
      render(<SignalLight signal="green" />);
      const light = screen.getByTestId('signal-light');
      expect(light).toBeInTheDocument();
      expect(light).toHaveClass('signal-green');
      expect(light).toHaveTextContent('green');
    });

    it('should render yellow signal with correct styling', () => {
      render(<SignalLight signal="yellow" />);
      const light = screen.getByTestId('signal-light');
      expect(light).toBeInTheDocument();
      expect(light).toHaveClass('signal-yellow');
      expect(light).toHaveTextContent('yellow');
    });

    it('should render red signal with correct styling', () => {
      render(<SignalLight signal="red" />);
      const light = screen.getByTestId('signal-light');
      expect(light).toBeInTheDocument();
      expect(light).toHaveClass('signal-red');
      expect(light).toHaveTextContent('red');
    });

    it('should use semantic CSS tokens for signal colors', () => {
      render(<SignalLight signal="green" />);
      const light = screen.getByTestId('signal-light');

      // Verify inline style uses CSS custom properties
      expect(light.getAttribute('style')).toContain('--color-signal-green');
    });

    it('should NOT recalculate signal - directly consumes backend value', () => {
      // This test documents the contract: SignalLight only renders what it receives
      // No calculation logic should exist in the component (verified by code review)
      render(<SignalLight signal="green" />);

      const light = screen.getByTestId('signal-light');
      expect(light).toHaveTextContent('green');

      // If there was calculation logic, test would check for it
      // But this component should be stateless and just render props.signal
    });
  });

  describe('Edge cases and accessibility', () => {
    it('should have aria-label for accessibility', () => {
      render(<SignalLight signal="green" />);
      const light = screen.getByTestId('signal-light');
      expect(light).toHaveAttribute('aria-label', 'result.signalLabel.green');
    });
  });
});
