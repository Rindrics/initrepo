import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Command } from 'commander';
import type { GeneratedFile } from '../generators/project';
import { loadTemplate } from '../generators/project';

export interface SetupRenovateOptions {
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
 * Generate renovate configuration
 */
function generateRenovateSetup(): GeneratedFile[] {
  return [
    {
      path: 'renovate.json5',
      content: loadTemplate('common/renovate.json5.ejs', {}),
    },
  ];
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
 * Main setup-renovate logic
 */
export async function setupRenovate(
  options: SetupRenovateOptions,
): Promise<void> {
  const targetDir = options.targetDir ?? process.cwd();
  const force = options.force ?? false;

  // Check if package.json exists
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!(await fileExists(packageJsonPath))) {
    throw new Error('package.json not found. Are you in a project directory?');
  }

  console.log('🔧 Setting up Renovate configuration...\n');

  // Generate renovate files
  const files = generateRenovateSetup();

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

  console.log('\n🎉 Renovate setup complete!');
  console.log('\n📋 Next steps:');
  console.log(
    '   1. Install Renovate GitHub App: https://github.com/apps/renovate',
  );
  console.log('   2. Grant access to this repository');
}

export function registerSetupRenovateCommand(program: Command): void {
  program
    .command('setup-renovate')
    .description('Set up Renovate configuration in an existing project')
    .option(
      '-t, --target-dir <path>',
      'Target directory (defaults to current directory)',
    )
    .option('-f, --force', 'Overwrite existing files')
    .action(async (opts: { targetDir?: string; force?: boolean }) => {
      try {
        await setupRenovate({
          targetDir: opts.targetDir,
          force: opts.force,
        });
      } catch (error) {
        console.error(
          `❌ Failed to setup Renovate: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });
}
