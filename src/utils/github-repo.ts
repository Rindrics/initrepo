import { Octokit } from 'octokit';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate: boolean;
}

export interface GitHubRepoResult {
  url: string;
  cloneUrl: string;
  alreadyExisted: boolean;
}

/**
 * Labels required for tagpr workflow
 */
const TAGPR_LABELS = [
  {
    name: 'tagpr:minor',
    color: '0e8a16',
    description: 'have tagpr bump minor version',
  },
  {
    name: 'tagpr:major',
    color: 'd93f0b',
    description: 'have tagpr bump major version',
  },
] as const;

export class RepoAlreadyExistsError extends Error {
  constructor(
    public readonly repoName: string,
    public readonly repoUrl: string,
    public readonly cloneUrl: string,
  ) {
    super(`Repository "${repoName}" already exists`);
    this.name = 'RepoAlreadyExistsError';
  }
}

/**
 * Creates a GitHub repository and sets up tagpr labels
 */
export async function createGitHubRepo(
  options: CreateRepoOptions,
): Promise<GitHubRepoResult> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      'GITHUB_TOKEN environment variable is required for repository creation',
    );
  }

  const octokit = new Octokit({ auth: token });

  // Get authenticated user
  const { data: user } = await octokit.rest.users.getAuthenticated();

  let repoUrl: string;
  let cloneUrl: string;
  let alreadyExisted = false;

  // Create repository
  try {
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description ?? '',
      private: options.isPrivate,
      auto_init: false,
    });
    repoUrl = repo.html_url;
    cloneUrl = repo.clone_url;
  } catch (error) {
    const apiError = error as { status?: number; message?: string };

    // Repository already exists (422 Unprocessable Entity)
    if (apiError.status === 422) {
      // Fetch existing repo info
      try {
        const { data: existingRepo } = await octokit.rest.repos.get({
          owner: user.login,
          repo: options.name,
        });
        repoUrl = existingRepo.html_url;
        cloneUrl = existingRepo.clone_url;
        alreadyExisted = true;
      } catch {
        throw new Error(
          `Repository "${options.name}" already exists but could not fetch its details`,
        );
      }
    } else {
      throw error;
    }
  }

  // Create tagpr labels (skip silently if already exist)
  await createTagprLabels(octokit, user.login, options.name);

  return {
    url: repoUrl,
    cloneUrl,
    alreadyExisted,
  };
}

/**
 * Creates tagpr labels for a repository
 */
async function createTagprLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  for (const label of TAGPR_LABELS) {
    try {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    } catch (error) {
      // Label already exists (422), ignore
      const apiError = error as { status?: number };
      if (apiError.status !== 422) {
        throw error;
      }
    }
  }
}

/**
 * Checks if GITHUB_TOKEN is available
 */
export function hasGitHubToken(): boolean {
  return !!process.env.GITHUB_TOKEN;
}
