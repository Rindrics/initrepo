#!/usr/bin/env node
import { Command } from 'commander';
import packageJson from '../package.json';
import { registerInitCommand } from './commands/init';

const { version: VERSION, name: NAME } = packageJson;

export function createProgram(): Command {
  const program = new Command();

  program
    .name(NAME)
    .description('Rapid repository setup CLI tool')
    .version(VERSION);

  registerInitCommand(program);

  return program;
}

// Run CLI when executed directly
if (import.meta.main) {
  const program = createProgram();
  program.parse();
}
