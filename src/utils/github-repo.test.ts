import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { hasGitHubToken } from './github-repo';

describe('github-repo utils', () => {
  describe('hasGitHubToken', () => {
    const originalToken = process.env.GITHUB_TOKEN;

    afterEach(() => {
      if (originalToken !== undefined) {
        process.env.GITHUB_TOKEN = originalToken;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    });

    test('should return true when GITHUB_TOKEN is set', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      expect(hasGitHubToken()).toBe(true);
    });

    test('should return false when GITHUB_TOKEN is not set', () => {
      delete process.env.GITHUB_TOKEN;
      expect(hasGitHubToken()).toBe(false);
    });

    test('should return false when GITHUB_TOKEN is empty', () => {
      process.env.GITHUB_TOKEN = '';
      expect(hasGitHubToken()).toBe(false);
    });
  });

  // Note: createGitHubRepo is not tested here because it requires
  // actual GitHub API calls. Integration tests should be done separately.
});
