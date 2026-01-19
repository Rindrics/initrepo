import type { GeneratedFile } from './project';
import { loadTemplate } from './project';

const HUSKY_HOOKS = [
  'commit-msg',
  'pre-commit',
  'post-commit',
  'pre-push',
] as const;

export type HuskyHook = (typeof HUSKY_HOOKS)[number];

/**
 * Generate husky hook files
 */
export function generateHuskyHooks(): GeneratedFile[] {
  return HUSKY_HOOKS.map((hook) => ({
    path: `.husky/${hook}`,
    content: loadTemplate(`common/husky/${hook}.ejs`, {}),
  }));
}

/**
 * Generate lint-staged configuration files
 */
export function generateLintStagedConfigs(): GeneratedFile[] {
  return [
    {
      path: '.lintstagedrc.json',
      content: loadTemplate('common/lintstagedrc.json.ejs', {}),
    },
    {
      path: '.lintstagedrc.format.json',
      content: loadTemplate('common/lintstagedrc.format.json.ejs', {}),
    },
  ];
}

/**
 * Generate all husky-related files (hooks + lint-staged configs)
 */
export function generateHuskySetup(): GeneratedFile[] {
  return [...generateHuskyHooks(), ...generateLintStagedConfigs()];
}
