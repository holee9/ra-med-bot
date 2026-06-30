// @MX:NOTE [AUTO] Unit tests for parseGitUrl — validates HTTPS/SSH parsing.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

import { describe, it, expect } from 'vitest';
import { parseGitUrl } from '@/lib/knowledge-sources/parse-git-url';

describe('parseGitUrl', () => {
  describe('HTTPS URLs', () => {
    it('should parse HTTPS URL with .git suffix', () => {
      const result = parseGitUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse HTTPS URL without .git suffix', () => {
      const result = parseGitUrl('https://github.com/owner/repo');
      expect(result).toEqual({
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse HTTPS URL with custom host', () => {
      const result = parseGitUrl('https://gitlab.com/owner/repo.git');
      expect(result).toEqual({
        host: 'gitlab.com',
        owner: 'owner',
        repo: 'repo',
      });
    });
  });

  describe('SSH URLs', () => {
    it('should parse SSH URL with .git suffix', () => {
      const result = parseGitUrl('git@github.com:owner/repo.git');
      expect(result).toEqual({
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse SSH URL without .git suffix', () => {
      const result = parseGitUrl('git@github.com:owner/repo');
      expect(result).toEqual({
        host: 'github.com',
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should parse SSH URL with custom host', () => {
      const result = parseGitUrl('git@gitlab.com:owner/repo.git');
      expect(result).toEqual({
        host: 'gitlab.com',
        owner: 'owner',
        repo: 'repo',
      });
    });
  });

  describe('Invalid URLs', () => {
    it('should return null for empty string', () => {
      const result = parseGitUrl('');
      expect(result).toBeNull();
    });

    it('should return null for malformed URL', () => {
      const result = parseGitUrl('not-a-git-url');
      expect(result).toBeNull();
    });

    it('should return null for URL without owner/repo', () => {
      const result = parseGitUrl('https://github.com/');
      expect(result).toBeNull();
    });
  });
});
