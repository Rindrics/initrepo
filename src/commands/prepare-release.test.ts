import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import {
  detectDevcode,
  prepareRelease,
  registerPrepareReleaseCommand,
} from './prepare-release';

describe('prepare-release command', () => {
  const testDir = path.join(import.meta.dir, '../../.test-prepare-release');

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.github/workflows'), {
      recursive: true,
    });
    await fs.mkdir(path.join(testDir, '.github/codeql'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('detectDevcode', () => {
    test('should return devcode name when private: true', async () => {
      const packageJson = {
        name: 'my-devcode',
        version: '0.0.0',
        private: true,
      };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson),
      );

      const devcode = await detectDevcode(testDir);
      expect(devcode).toBe('my-devcode');
    });

    test('should throw when private flag is missing', async () => {
      const packageJson = { name: 'my-project', version: '0.0.0' };
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson),
      );

      expect(detectDevcode(testDir)).rejects.toThrow('not a devcode project');
    });

    test('should throw when package.json not found', async () => {
      expect(detectDevcode(testDir)).rejects.toThrow('package.json not found');
    });
  });

  describe('prepareRelease', () => {
    test('should replace only in managed locations', async () => {
      // Setup test files with private: true
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'devcode', version: '0.0.0', private: true }),
      );
      await fs.writeFile(
        path.join(testDir, '.github/workflows/tagpr.yml'),
        `name: tagpr
jobs:
  tagpr:
    steps:
      - uses: actions/checkout@v6
        # TODO: After replace-devcode, add token: \${{ secrets.PAT_FOR_TAGPR }}
      - uses: Songmu/tagpr@v1
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`,
      );
      await fs.writeFile(
        path.join(testDir, '.github/codeql/codeql-config.yml'),
        'name: "CodeQL config for devcode"\n\npaths:\n  - src',
      );

      await prepareRelease({
        publishName: '@scope/package',
        targetDir: testDir,
      });

      // Verify package.json - name should be replaced
      const pkg = JSON.parse(
        await fs.readFile(path.join(testDir, 'package.json'), 'utf-8'),
      );
      expect(pkg.name).toBe('@scope/package');
      expect(pkg.private).toBeUndefined();

      // Verify tagpr.yml - tokens should be replaced
      const tagpr = await fs.readFile(
        path.join(testDir, '.github/workflows/tagpr.yml'),
        'utf-8',
      );
      expect(tagpr).toContain('secrets.PAT_FOR_TAGPR');
      expect(tagpr).not.toContain('secrets.GITHUB_TOKEN');

      // Verify codeql-config.yml - only name field should be replaced
      const codeql = await fs.readFile(
        path.join(testDir, '.github/codeql/codeql-config.yml'),
        'utf-8',
      );
      expect(codeql).toContain('@scope/package');
    });

    test('should detect unmanaged occurrences', async () => {
      // Setup with devcode appearing in an unmanaged file
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'my-devcode', version: '0.0.0', private: true }),
      );
      await fs.writeFile(
        path.join(testDir, 'src/index.ts'),
        'console.log("Hello from my-devcode!");',
      );

      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      try {
        await prepareRelease({
          publishName: '@scope/package',
          targetDir: testDir,
        });
      } finally {
        console.log = originalLog;
      }

      // Verify unmanaged occurrence was reported
      const output = logs.join('\n');
      expect(output).toContain('unmanaged occurrence');
      expect(output).toContain('src/index.ts');

      // Verify unmanaged file was NOT modified
      const srcContent = await fs.readFile(
        path.join(testDir, 'src/index.ts'),
        'utf-8',
      );
      expect(srcContent).toContain('my-devcode');
      expect(srcContent).not.toContain('@scope/package');
    });

    test('should fail if not a devcode project', async () => {
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'not-devcode', version: '1.0.0' }),
      );

      expect(
        prepareRelease({ publishName: '@scope/package', targetDir: testDir }),
      ).rejects.toThrow('not a devcode project');
    });
  });

  describe('registerPrepareReleaseCommand', () => {
    test('should register prepare-release command with publish-name argument', () => {
      const program = new Command();
      registerPrepareReleaseCommand(program);

      const cmd = program.commands.find((c) => c.name() === 'prepare-release');
      expect(cmd).toBeDefined();
      expect(cmd?.description()).toContain('auto-detects');
    });

    test('should have target-dir option', () => {
      const program = new Command();
      registerPrepareReleaseCommand(program);

      const cmd = program.commands.find((c) => c.name() === 'prepare-release');
      const options = cmd?.options.map((o) => o.long);

      expect(options).toContain('--target-dir');
    });
  });
});
