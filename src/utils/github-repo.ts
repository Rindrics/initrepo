import { Octokit } from 'octokit';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate: boolean;
}

export interface GitHubRepoResult {
  url: string;
  cloneUrl: string;
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

  // Create repository
  const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
    name: options.name,
    description: options.description ?? '',
    private: options.isPrivate,
    auto_init: false,
  });

  // Create tagpr labels
  for (const label of TAGPR_LABELS) {
    try {
      await octokit.rest.issues.createLabel({
        owner: user.login,
        repo: options.name,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    } catch (error) {
      // Label might already exist, ignore
      const apiError = error as { status?: number };
      if (apiError.status !== 422) {
        throw error;
      }
    }
  }

  return {
    url: repo.html_url,
    cloneUrl: repo.clone_url,
  };
}

/**
 * Checks if GITHUB_TOKEN is available
 */
export function hasGitHubToken(): boolean {
  return !!process.env.GITHUB_TOKEN;
}
