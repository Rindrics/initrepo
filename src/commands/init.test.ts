import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { Command } from 'commander';
import { initProject, registerInitCommand, validateLanguage } from './init';

describe('init command', () => {
  describe('validateLanguage', () => {
    test('should accept typescript', () => {
      expect(validateLanguage('typescript')).toBe('typescript');
    });

    test('should throw for unsupported language', () => {
      expect(() => validateLanguage('python')).toThrow(
        'Unsupported language: python',
      );
    });
  });

  describe('initProject', () => {
    let consoleSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('should log project creation message', async () => {
      await initProject({
        projectName: 'test-project',
        lang: 'typescript',
        isDevcode: false,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Creating project: test-project (typescript)',
      );
    });

    test('should include devcode label when isDevcode is true', async () => {
      await initProject({
        projectName: 'test-project',
        lang: 'typescript',
        isDevcode: true,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Creating project: test-project (typescript) [devcode]',
      );
    });
  });

  describe('registerInitCommand', () => {
    test('should register init command to program', () => {
      const program = new Command();
      registerInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === 'init');
      expect(initCmd).toBeDefined();
      expect(initCmd?.description()).toContain('npm publish');
    });

    test('should have --devcode option', () => {
      const program = new Command();
      registerInitCommand(program);

      const initCmd = program.commands.find((cmd) => cmd.name() === 'init');
      const devcodeOption = initCmd?.options.find(
        (opt) => opt.long === '--devcode',
      );
      expect(devcodeOption).toBeDefined();
    });
  });
});
