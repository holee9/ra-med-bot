import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderTemplate,
  validateTemplateVariables,
  registerTemplate,
  getRegisteredTemplates,
  TemplateNotFoundError,
  TemplateMissingVariablesError,
} from '@/lib/workflows/common/template-engine';

describe('template-engine', () => {
  beforeEach(() => {
    // Register a known template before each test
    registerTemplate(
      'test-template',
      'Hello {{name}}, your device class is {{device_class}}.',
      ['name', 'device_class'],
    );
  });

  describe('renderTemplate', () => {
    it('replaces placeholders correctly', () => {
      const result = renderTemplate('test-template', {
        name: 'Acme Inc',
        device_class: 'II',
      });
      expect(result).toBe('Hello Acme Inc, your device class is II.');
    });

    it('leaves unknown placeholders as-is when variable not provided', () => {
      const result = renderTemplate('test-template', { name: 'Acme Inc' });
      // device_class not provided — placeholder should remain
      expect(result).toContain('{{device_class}}');
      expect(result).toContain('Acme Inc');
    });

    it('throws TemplateNotFoundError for unknown template', () => {
      expect(() => renderTemplate('nonexistent-template', {})).toThrow(
        TemplateNotFoundError,
      );
    });
  });

  describe('validateTemplateVariables', () => {
    it('returns valid=true when all required variables are present', () => {
      const result = validateTemplateVariables('test-template', {
        name: 'Test',
        device_class: 'I',
      });
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('returns missing keys when required variables are absent', () => {
      const result = validateTemplateVariables('test-template', { name: 'Test' });
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('device_class');
    });

    it('throws TemplateNotFoundError for unknown template', () => {
      expect(() => validateTemplateVariables('no-such-template', {})).toThrow(
        TemplateNotFoundError,
      );
    });
  });

  describe('registerTemplate and getRegisteredTemplates', () => {
    it('registers a new template and it appears in the list', () => {
      registerTemplate('my-new-template', 'Content {{var}}', ['var']);
      expect(getRegisteredTemplates()).toContain('my-new-template');
    });

    it('getRegisteredTemplates includes previously registered templates', () => {
      const templates = getRegisteredTemplates();
      expect(templates).toContain('test-template');
    });
  });
});
