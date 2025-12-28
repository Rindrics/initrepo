import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Command } from 'commander';

export interface PrepareReleaseOptions {
  /** New package name for release */
  publishName: string;
  /** Target directory (defaults to current directory) */
  targetDir?: string;
}

interface PackageJson {
  name: string;
  private?: boolean;
  [key: string]: unknown;
}

/**
 * Managed locations where devcode replacement is performed automatically.
 * Each location specifies the file and how to replace.
 */
interface ManagedLocation {
  file: string;
  description: string;
  replace: (
    targetDir: string,
    devcode: string,
    publishName: string,
  ) => Promise<void>;
}

/**
 * Reads package.json and detects if this is a devcode project
 * Returns the devcode name if private: true, otherwise throws
 */
export async function detectDevcode(targetDir: string): Promise<string> {
  const packageJsonPath = path.join(targetDir, 'package.json');

  let content: string;
  try {
    content = await fs.readFile(packageJsonPath, 'utf-8');
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      throw new Error(
        'package.json not found. Are you in a project directory?',
      );
    }
    throw error;
  }

  const pkg = JSON.parse(content) as PackageJson;

  if (!pkg.private) {
    throw new Error(
      'This project is not a devcode project (missing "private": true in package.json)',
    );
  }

  return pkg.name;
}

/**
 * Updates package.json: replaces name and removes "private": true
 * This is a MANAGED replacement - only touches the "name" field
 */
async function replaceInPackageJson(
  targetDir: string,
  _devcode: string,
  publishName: string,
): Promise<void> {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const content = await fs.readFile(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(content) as PackageJson;

  // Only replace the managed "name" field
  pkg.name = publishName;

  // Remove private flag
  delete pkg.private;

  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf-8',
  );
}

/**
 * Updates codeql-config.yml: replaces only the "name" field
 * This is a MANAGED replacement - only touches the YAML name field
 */
async function replaceInCodeqlConfig(
  targetDir: string,
  devcode: string,
  publishName: string,
): Promise<void> {
  const configPath = path.join(targetDir, '.github/codeql/codeql-config.yml');

  let content: string;
  try {
    content = await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      return; // File doesn't exist, nothing to do
    }
    throw error;
  }

  // Line-based parsing to avoid ReDoS vulnerability
  // Only replace devcode in the first line that starts with "name:"
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('name:')) {
      // Replace devcode only in this specific line
      lines[i] = line.replace(devcode, publishName);
      break;
    }
  }
  content = lines.join('\n');

  await fs.writeFile(configPath, content, 'utf-8');
}

/**
 * Updates tagpr.yml: switches from GITHUB_TOKEN to PAT_FOR_TAGPR
 * This is a MANAGED replacement - only touches specific workflow patterns
 */
async function replaceInTagprWorkflow(
  targetDir: string,
  _devcode: string,
  _publishName: string,
): Promise<void> {
  const workflowPath = path.join(targetDir, '.github/workflows/tagpr.yml');

  let content: string;
  try {
    content = await fs.readFile(workflowPath, 'utf-8');
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      return; // File doesn't exist, nothing to do
    }
    throw error;
  }

  // Replace GITHUB_TOKEN with PAT_FOR_TAGPR in env
  content = content.replace(
    /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/g,
    'GITHUB_TOKEN: ${{ secrets.PAT_FOR_TAGPR }}',
  );

  // Add token to checkout if not present
  content = content.replace(
    /(uses: actions\/checkout@v\d+)\n(\s*)# TODO: After replace-devcode, add token: \$\{\{ secrets\.PAT_FOR_TAGPR \}\}/g,
    '$1\n$2with:\n$2  token: ${{ secrets.PAT_FOR_TAGPR }}',
  );

  // Remove remaining TODO comments
  content = content.replace(/\s*# TODO: After replace-devcode.*\n/g, '\n');

  // Clean up extra blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  await fs.writeFile(workflowPath, content, 'utf-8');
}

/**
 * Managed locations where devcode is automatically replaced
 */
const MANAGED_LOCATIONS: ManagedLocation[] = [
  {
    file: 'package.json',
    description: 'name field',
    replace: replaceInPackageJson,
  },
  {
    file: '.github/codeql/codeql-config.yml',
    description: 'name field',
    replace: replaceInCodeqlConfig,
  },
  {
    file: '.github/workflows/tagpr.yml',
    description: 'GITHUB_TOKEN → PAT_FOR_TAGPR',
    replace: replaceInTagprWorkflow,
  },
];

/**
 * Scans project for unmanaged occurrences of devcode
 */
async function findUnmanagedOccurrences(
  targetDir: string,
  devcode: string,
): Promise<{ file: string; line: number; content: string }[]> {
  const occurrences: { file: string; line: number; content: string }[] = [];
  const managedFiles = new Set(MANAGED_LOCATIONS.map((l) => l.file));

  // Files to scan (excluding node_modules, .git, etc.)
  const filesToScan = await findFilesRecursive(targetDir, [
    'node_modules',
    '.git',
    'dist',
    'bun.lockb',
  ]);

  for (const file of filesToScan) {
    const relativePath = path.relative(targetDir, file);

    // Skip managed files
    if (managedFiles.has(relativePath)) {
      continue;
    }

    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(devcode)) {
          occurrences.push({
            file: relativePath,
            line: i + 1,
            content: lines[i].trim().substring(0, 80),
          });
        }
      }
    } catch {
      // Skip files that can't be read (binary, etc.)
    }
  }

  return occurrences;
}

/**
 * Recursively find all files in a directory
 */
async function findFilesRecursive(
  dir: string,
  excludeDirs: string[],
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          files.push(...(await findFilesRecursive(fullPath, excludeDirs)));
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Skip directories that can't be read
  }

  return files;
}

/**
 * Main prepare-release logic
 */
export async function prepareRelease(
  options: PrepareReleaseOptions,
): Promise<void> {
  const targetDir = options.targetDir ?? process.cwd();

  // Detect devcode from package.json (private: true)
  const devcode = await detectDevcode(targetDir);

  console.log(`Detected devcode project: ${devcode}`);
  console.log(`Preparing release: ${devcode} → ${options.publishName}\n`);

  // Process managed locations
  console.log('📁 Managed replacements:');
  for (const location of MANAGED_LOCATIONS) {
    try {
      await location.replace(targetDir, devcode, options.publishName);
      console.log(`   ✅ ${location.file} (${location.description})`);
    } catch (error) {
      console.log(
        `   ⚠️  ${location.file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Scan for unmanaged occurrences
  const unmanaged = await findUnmanagedOccurrences(targetDir, devcode);

  if (unmanaged.length > 0) {
    console.log(
      `\n⚠️  Found ${unmanaged.length} unmanaged occurrence(s) of "${devcode}":`,
    );
    console.log(
      '   These were NOT automatically replaced. Please review manually:',
    );
    for (const occurrence of unmanaged) {
      console.log(`   - ${occurrence.file}:${occurrence.line}`);
      console.log(`     ${occurrence.content}`);
    }
  }

  console.log(`\n🎉 Release preparation complete!`);
  console.log(`   Package renamed: ${devcode} → ${options.publishName}`);
  console.log(`   Private flag removed`);
  console.log(`   Workflows updated to use PAT_FOR_TAGPR`);

  console.log(`\n⚠️  Action required: Set up PAT_FOR_TAGPR secret`);
  console.log(`   1. Create a Personal Access Token (classic) at:`);
  console.log(`      https://github.com/settings/tokens/new`);
  console.log(`   2. Required permissions:`);
  console.log(`      • repo (Full control of private repositories)`);
  console.log(`        - or for public repos: public_repo`);
  console.log(`      • workflow (Update GitHub Action workflows)`);
  console.log(
    `   3. Add the token as a repository secret named PAT_FOR_TAGPR:`,
  );
  console.log(
    `      Settings → Secrets and variables → Actions → New repository secret`,
  );
}

export function registerPrepareReleaseCommand(program: Command): void {
  program
    .command('prepare-release <publish-name>')
    .description(
      'Prepare a devcode project for release (auto-detects devcode from package.json)',
    )
    .option(
      '-t, --target-dir <path>',
      'Target directory (defaults to current directory)',
    )
    .action(async (publishName: string, opts: { targetDir?: string }) => {
      try {
        await prepareRelease({
          publishName,
          targetDir: opts.targetDir,
        });
      } catch (error) {
        console.error(
          `❌ Failed to prepare release: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });
}
