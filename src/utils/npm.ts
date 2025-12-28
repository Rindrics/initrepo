import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type ExecFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

/**
 * Fetches the latest version of a package from npm registry
 */
export async function getLatestVersion(packageName: string): Promise<string> {
  const response = await fetch(
    `https://registry.npmjs.org/${packageName}/latest`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch version for ${packageName}`);
  }

  const data = (await response.json()) as { version: string };
  return data.version;
}

/**
 * Gets the current npm username if logged in
 * @param execFn - Optional exec function for testing (defaults to execAsync)
 */
export async function getNpmUsername(
  execFn: ExecFn = execAsync,
): Promise<string | null> {
  try {
    const { stdout } = await execFn('npm whoami');
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Fetches latest versions for multiple packages
 */
export async function getLatestVersions(
  packageNames: string[],
): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};

  await Promise.all(
    packageNames.map(async (name) => {
      try {
        versions[name] = await getLatestVersion(name);
      } catch {
        // Fallback to a default version if fetch fails
        versions[name] = 'latest';
      }
    }),
  );

  return versions;
}
