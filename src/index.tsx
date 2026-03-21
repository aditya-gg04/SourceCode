#!/usr/bin/env node
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import App from './tui/App.js';

const program = new Command();

program
  .name('sourcecode')
  .description('AI-powered terminal tool for navigating large codebases')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a repository and start the TUI')
  .argument('[path]', 'Path or URL of the repository to analyze', '.')
  .action((path: string) => {
    // Basic terminal UI render placeholder
    render(React.createElement(App, { repositoryPath: path }));
  });

program.parse();
