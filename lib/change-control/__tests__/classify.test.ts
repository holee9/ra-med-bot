// @MX:NOTE [AUTO] Unit tests for change-type classification (REQ-003, AC-02).
// @MX:SPEC SPEC-REGULA-CHANGE-CONTROL-001 (REQ-003)

import { describe, expect, it } from 'vitest';
import { classifyChangeType, isValidChangeType } from '../classify';

describe('classifyChangeType (REQ-003)', () => {
  it('classifies design changes', () => {
    expect(classifyChangeType('Modified the housing design to be smaller')).toBe('design');
    expect(classifyChangeType('설계 사양 변경')).toBe('design');
  });

  it('classifies material changes', () => {
    expect(classifyChangeType('Switched housing material to polycarbonate')).toBe('material');
    expect(classifyChangeType('소재 변경')).toBe('material');
  });

  it('classifies manufacturing_process changes', () => {
    expect(classifyChangeType('Updated sterilization process parameters')).toBe(
      'manufacturing_process',
    );
    expect(classifyChangeType('제조 공정 변경')).toBe('manufacturing_process');
  });

  it('classifies software changes', () => {
    expect(classifyChangeType('Firmware version 2.3 update with new algorithm')).toBe('software');
    expect(classifyChangeType('소프트웨어 업데이트')).toBe('software');
  });

  it('classifies labeling changes', () => {
    expect(classifyChangeType('Updated labeling and IFU text')).toBe('labeling');
    expect(classifyChangeType('라벨 변경')).toBe('labeling');
  });

  it('classifies intended_use changes', () => {
    expect(classifyChangeType('Extended indication to pediatric population')).toBe('intended_use');
    expect(classifyChangeType('적응증 확대')).toBe('intended_use');
  });

  it('falls back to design when no keyword matches', () => {
    expect(classifyChangeType('xyz qwerty')).toBe('design');
  });
});

describe('isValidChangeType (REQ-003 guard)', () => {
  it('accepts the 6 canonical types', () => {
    expect(isValidChangeType('design')).toBe(true);
    expect(isValidChangeType('material')).toBe(true);
    expect(isValidChangeType('manufacturing_process')).toBe(true);
    expect(isValidChangeType('software')).toBe(true);
    expect(isValidChangeType('labeling')).toBe(true);
    expect(isValidChangeType('intended_use')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidChangeType('other')).toBe(false);
    expect(isValidChangeType('Design')).toBe(false); // case-sensitive
    expect(isValidChangeType('')).toBe(false);
  });
});
