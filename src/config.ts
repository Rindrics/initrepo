/**
 * GitHub Actions configuration for generated workflows
 * Key: action name, Value: fallback version when API fetch fails
 */
export const GITHUB_ACTIONS = {
  'actions/checkout': 'v6',
  'Songmu/tagpr': 'v1',
} as const;

/** Default fallback version for unknown actions */
export const DEFAULT_ACTION_VERSION = 'v1';
