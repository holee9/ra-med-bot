import { describe, expect, it } from 'vitest';
import { getStatusColor } from '../../../../components/workflows/WorkflowStatusBadge';

describe('getStatusColor', () => {
  it('maps approved to green color class', () => {
    const color = getStatusColor('approved');
    expect(color).toContain('green');
  });

  it('maps failed to red color class', () => {
    const color = getStatusColor('failed');
    expect(color).toContain('red');
  });

  it('maps pending_review to orange color class', () => {
    const color = getStatusColor('pending_review');
    expect(color).toContain('orange');
  });

  it('all 7 status values have a defined color', () => {
    const statuses = [
      'queued',
      'running',
      'paused',
      'pending_review',
      'approved',
      'rejected',
      'failed',
    ] as const;

    for (const status of statuses) {
      const color = getStatusColor(status);
      expect(color).toBeTruthy();
      expect(typeof color).toBe('string');
    }
  });

  it('maps queued to gray color class', () => {
    const color = getStatusColor('queued');
    expect(color).toContain('gray');
  });

  it('maps running to blue color class', () => {
    const color = getStatusColor('running');
    expect(color).toContain('blue');
  });

  it('maps paused to yellow color class', () => {
    const color = getStatusColor('paused');
    expect(color).toContain('yellow');
  });

  it('maps rejected to red color class', () => {
    const color = getStatusColor('rejected');
    expect(color).toContain('red');
  });
});
