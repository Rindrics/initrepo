import { DEFAULT_ACTION_VERSION, GITHUB_ACTIONS } from '../config';

/**
 * Fetches the latest major version tag for a GitHub Action
 * @param repo - Repository in format "owner/repo" (e.g., "actions/checkout")
 * @returns Latest major version tag (e.g., "v4")
 */
export async function getLatestActionVersion(repo: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release for ${repo}`);
  }

  const data = (await response.json()) as { tag_name: string };
  // Extract major version (e.g., "v4.2.0" -> "v4")
  const match = data.tag_name.match(/^v?(\d+)/);
  return match ? `v${match[1]}` : data.tag_name;
}

/**
 * Fetches latest major versions for all configured GitHub Actions
 */
export async function getLatestActionVersions(
  actions: readonly string[] = Object.keys(GITHUB_ACTIONS),
): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};

  await Promise.all(
    actions.map(async (action) => {
      try {
        versions[action] = await getLatestActionVersion(action);
      } catch {
        versions[action] =
          GITHUB_ACTIONS[action as keyof typeof GITHUB_ACTIONS] ??
          DEFAULT_ACTION_VERSION;
      }
    }),
  );

  return versions;
}

// Re-export for convenience
export { GITHUB_ACTIONS };
