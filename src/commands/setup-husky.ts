import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Command } from 'commander';
import { generateHuskySetup } from '../generators/husky';
import type { GeneratedFile } from '../generators/project';

export interface SetupHuskyOptions {
  /** Target directory (defaults to current directory) */
  targetDir?: string;
  /** Force overwrite existing files */
  force?: boolean;
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write generated files to target directory
 */
async function writeFiles(
  targetDir: string,
  files: GeneratedFile[],
  force: boolean,
): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const filePath = path.join(targetDir, file.path);
    const fileDir = path.dirname(filePath);

    // Check if file exists
    if (!force && (await fileExists(filePath))) {
      skipped.push(file.path);
      continue;
    }

    // Create directory if needed
    await fs.mkdir(fileDir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, file.content, 'utf-8');
    written.push(file.path);
  }

  return { written, skipped };
}

/**
 * Main setup-husky logic
 */
export async function setupHusky(options: SetupHuskyOptions): Promise<void> {
  const targetDir = options.targetDir ?? process.cwd();
  const force = options.force ?? false;

  // Check if package.json exists
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!(await fileExists(packageJsonPath))) {
    throw new Error(
      'package.json not found. Are you in a project directory?',
    );
  }

  console.log('🔧 Setting up husky hooks and lint-staged config...\n');

  // Generate husky files
  const files = generateHuskySetup();

  // Write files
  const { written, skipped } = await writeFiles(targetDir, files, force);

  // Report results
  if (written.length > 0) {
    console.log('✅ Created files:');
    for (const file of written) {
      console.log(`   ${file}`);
    }
  }

  if (skipped.length > 0) {
    console.log('\n⏭️  Skipped (already exist, use --force to overwrite):');
    for (const file of skipped) {
      console.log(`   ${file}`);
    }
  }

  console.log('\n🎉 Husky setup complete!');
  console.log('\n📋 Next steps:');
  console.log('   1. Install dependencies: bun install');
  console.log('   2. Initialize husky: bun run prepare');
  console.log('   3. Ensure husky and lint-staged are in devDependencies');
}

export function registerSetupHuskyCommand(program: Command): void {
  program
    .command('setup-husky')
    .description('Set up husky hooks and lint-staged config in an existing project')
    .option(
      '-t, --target-dir <path>',
      'Target directory (defaults to current directory)',
    )
    .option(
      '-f, --force',
      'Overwrite existing files',
    )
    .action(async (opts: { targetDir?: string; force?: boolean }) => {
      try {
        await setupHusky({
          targetDir: opts.targetDir,
          force: opts.force,
        });
      } catch (error) {
        console.error(
          `❌ Failed to setup husky: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });
}
