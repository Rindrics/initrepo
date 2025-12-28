import * as readline from 'node:readline/promises';
import type { Command } from 'commander';
import { generateProject } from '../generators/project';
import type { InitOptions, Language } from '../types';
import { createGitHubRepo, hasGitHubToken } from '../utils/github-repo';

const SUPPORTED_LANGUAGES: Language[] = ['typescript'];

export function validateLanguage(lang: string): Language {
  if (!SUPPORTED_LANGUAGES.includes(lang as Language)) {
    throw new Error(
      `Unsupported language: ${lang}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
    );
  }
  return lang as Language;
}

/**
 * Prompts user with a yes/no question
 */
export async function promptYesNo(
  question: string,
  defaultValue = false,
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const hint = defaultValue ? '(Y/n)' : '(y/N)';

  try {
    const answer = await rl.question(`${question} ${hint}: `);
    if (answer.trim() === '') {
      return defaultValue;
    }
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

export interface InitProjectOptions extends InitOptions {
  createRepo?: boolean;
  isPrivate?: boolean;
}

export async function initProject(options: InitProjectOptions): Promise<void> {
  const devcodeLabel = options.isDevcode ? ' [devcode]' : '';
  console.log(
    `Creating project: ${options.projectName} (${options.lang})${devcodeLabel}`,
  );

  // Generate project files
  await generateProject(options);
  console.log(`✅ Project files created at ./${options.projectName}`);

  // Create GitHub repository if requested
  if (options.createRepo) {
    if (!hasGitHubToken()) {
      console.warn('⚠️  GITHUB_TOKEN not set, skipping repository creation');
      console.warn(
        '   Set GITHUB_TOKEN environment variable to enable repo creation',
      );
    } else {
      try {
        console.log('📦 Creating GitHub repository...');
        const result = await createGitHubRepo({
          name: options.projectName,
          description: options.isDevcode
            ? `[devcode] ${options.projectName}`
            : undefined,
          isPrivate: options.isPrivate ?? false,
        });
        console.log(`✅ GitHub repository created: ${result.url}`);
        console.log(`   Labels created: tagpr:minor, tagpr:major`);
        console.log(`\n   To push your code:`);
        console.log(`   cd ${options.projectName}`);
        console.log(`   git init`);
        console.log(`   git add .`);
        console.log(`   git commit -m "chore: initial commit"`);
        console.log(`   git remote add origin ${result.cloneUrl}`);
        console.log(`   git push -u origin main`);
      } catch (error) {
        console.error(
          `❌ Failed to create GitHub repository: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}

interface InitCommandOptions {
  lang: string;
  devcode?: boolean;
  author?: string;
  createRepo?: boolean;
  private?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init <project-name>')
    .description(
      'Initialize a new project. <project-name> is the name used for npm publish.',
    )
    .option('-l, --lang <language>', 'Project language', 'typescript')
    .option(
      '-d, --devcode',
      'Use devcode mode (adds private: true to package.json)',
    )
    .option('--no-devcode', 'Not a devcode project')
    .option(
      '-a, --author <name>',
      'Package author (defaults to npm whoami for TypeScript)',
    )
    .option(
      '--create-repo',
      'Create GitHub repository and tagpr labels (requires GITHUB_TOKEN)',
    )
    .option('--no-create-repo', 'Skip GitHub repository creation')
    .option('-p, --private', 'Make GitHub repository private')
    .option('--no-private', 'Make GitHub repository public')
    .action(async (projectName: string, opts: InitCommandOptions) => {
      const lang = validateLanguage(opts.lang);

      // Determine if devcode - prompt if not specified
      let isDevcode: boolean;
      if (opts.devcode !== undefined) {
        isDevcode = opts.devcode;
      } else {
        isDevcode = await promptYesNo(
          `Is "${projectName}" a developmental code?`,
          false,
        );
      }

      // Determine if create repo - prompt if not specified
      let createRepo: boolean;
      if (opts.createRepo !== undefined) {
        createRepo = opts.createRepo;
      } else {
        createRepo = await promptYesNo('Create GitHub repo?', true);
      }

      // Determine if private repo - prompt only if creating repo and not specified
      let isPrivate = false;
      if (createRepo) {
        if (opts.private !== undefined) {
          isPrivate = opts.private;
        } else {
          isPrivate = await promptYesNo('Make repo private?', false);
        }
      }

      await initProject({
        projectName,
        lang,
        isDevcode,
        author: opts.author,
        createRepo,
        isPrivate,
      });
    });
}
