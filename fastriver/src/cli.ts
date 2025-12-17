#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { processDirectory, getPhotosInDir, getSubdirs, sanitizeRepoName } from './index.js';
import { execSync } from 'child_process';

// Get version from package.json dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

function getGitUsername(): string | null {
  try {
    return execSync('git config user.name', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function printBanner() {
  console.log();
  console.log(chalk.bold.blue('  i4tow') + chalk.gray(' - Photo Album Creator'));
  console.log(chalk.gray('  Turn folders into shareable galleries'));
  console.log();
}

function printDivider() {
  console.log(chalk.gray('  ' + '─'.repeat(50)));
}

program
  .name('i4tow')
  .description('Create photo albums backed by GitHub repos')
  .version(packageJson.version, '-v, --version')
  .option('-t, --token <token>', 'GitHub token (or set GITHUB_TOKEN env)')
  .option('-u, --username <username>', 'GitHub username')
  .option('-d, --dry-run', 'Preview without making changes')
  .option('-s, --single', 'Create one album from current directory')
  .option('-b, --batch', 'Create album for each subdirectory')
  .argument('[directory]', 'Directory containing photos', '.')
  .action(async (directory: string, opts) => {
    printBanner();

    // Resolve directory path
    const dir = resolve(directory);

    // Validate directory exists
    if (!existsSync(dir)) {
      console.log(chalk.red(`  Error: Directory not found`));
      console.log(chalk.gray(`  Path: ${dir}`));
      console.log();
      process.exit(1);
    }

    // Get credentials
    const token = opts.token || process.env.GITHUB_TOKEN;
    const username = opts.username || process.env.GITHUB_USERNAME || getGitUsername();

    if (!token) {
      console.log(chalk.red('  Error: GitHub token required'));
      console.log();
      console.log(chalk.gray('  Options:'));
      console.log(chalk.gray('    1. Use --token flag: i4tow . --token ghp_xxxx'));
      console.log(chalk.gray('    2. Set environment variable: export GITHUB_TOKEN=ghp_xxxx'));
      console.log();
      console.log(chalk.gray('  Get a token at: https://github.com/settings/tokens'));
      console.log();
      process.exit(1);
    }

    if (!username) {
      console.log(chalk.red('  Error: GitHub username required'));
      console.log();
      console.log(chalk.gray('  Options:'));
      console.log(chalk.gray('    1. Use --username flag: i4tow . --username myuser'));
      console.log(chalk.gray('    2. Set environment variable: export GITHUB_USERNAME=myuser'));
      console.log();
      process.exit(1);
    }

    // Scan directory
    const photos = getPhotosInDir(dir);
    const subdirs = getSubdirs(dir);

    // Determine what will be created
    const isBatchMode = opts.batch || (!opts.single && subdirs.length > 0 && photos.length === 0);
    const albumsToCreate: { name: string; path: string; photoCount: number }[] = [];

    if (isBatchMode) {
      for (const subdir of subdirs) {
        const subdirPath = `${dir}/${subdir}`;
        const subdirPhotos = getPhotosInDir(subdirPath);
        if (subdirPhotos.length > 0) {
          albumsToCreate.push({
            name: `i4tow-${sanitizeRepoName(subdir)}`,
            path: subdirPath,
            photoCount: subdirPhotos.length,
          });
        }
      }
    } else if (photos.length > 0) {
      const dirName = dir.split('/').pop() || 'album';
      albumsToCreate.push({
        name: `i4tow-${sanitizeRepoName(dirName)}`,
        path: dir,
        photoCount: photos.length,
      });
    }

    // Show scan results
    console.log(chalk.white('  Scanning directory...'));
    console.log();
    console.log(chalk.gray(`  Location:   ${dir}`));
    console.log(chalk.gray(`  Photos:     ${photos.length} in root`));
    console.log(chalk.gray(`  Subfolders: ${subdirs.length}`));
    console.log(chalk.gray(`  Mode:       ${isBatchMode ? 'batch (one album per subfolder)' : 'single album'}`));
    console.log();

    if (albumsToCreate.length === 0) {
      console.log(chalk.yellow('  No photos found to upload.'));
      console.log();
      console.log(chalk.gray('  Make sure your directory contains:'));
      console.log(chalk.gray('    - Photos (.jpg, .jpeg, .png, .heic, .webp, .gif)'));
      console.log(chalk.gray('    - Or subfolders with photos (use --batch)'));
      console.log();
      process.exit(0);
    }

    // Show what will be created
    console.log(chalk.white(`  Albums to create: ${albumsToCreate.length}`));
    console.log();
    for (const album of albumsToCreate) {
      console.log(chalk.gray(`    ${album.name} (${album.photoCount} photos)`));
    }
    console.log();

    if (opts.dryRun) {
      printDivider();
      console.log();
      console.log(chalk.yellow('  DRY RUN - No changes made'));
      console.log();
      console.log(chalk.gray('  Remove --dry-run to create albums'));
      console.log();
      process.exit(0);
    }

    printDivider();
    console.log();

    // Process albums with live progress
    const spinner = ora({ text: '  Preparing...', prefixText: '' }).start();

    const results = await processDirectory(dir, {
      token,
      username,
      dryRun: opts.dryRun,
      single: opts.single,
      batch: opts.batch,
      onProgress: (step, detail) => {
        spinner.text = detail ? `  ${step}: ${detail}` : `  ${step}`;
      },
    });

    spinner.stop();

    // Show results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
      console.log(chalk.green.bold(`  ✓ Created ${successful.length} album${successful.length > 1 ? 's' : ''}`));
      console.log();

      for (const result of successful) {
        console.log(chalk.green(`    ✓ ${result.name}`));
        console.log(chalk.gray(`      ${result.photoCount} photos uploaded`));
        console.log(chalk.cyan(`      ${result.albumUrl}`));
        console.log();
      }
    }

    if (failed.length > 0) {
      console.log(chalk.red.bold(`  ✗ Failed: ${failed.length} album${failed.length > 1 ? 's' : ''}`));
      console.log();

      for (const result of failed) {
        console.log(chalk.red(`    ✗ ${result.name}`));
        console.log(chalk.gray(`      Error: ${result.error}`));
        console.log();
      }
    }

    if (successful.length > 0) {
      printDivider();
      console.log();
      console.log(chalk.white('  Next steps:'));
      console.log();
      console.log(chalk.gray('    1. Wait 2-5 minutes for GitHub Actions to process photos'));
      console.log(chalk.gray('    2. View your albums:'));
      console.log();
      for (const result of successful) {
        console.log(chalk.cyan(`       ${result.albumUrl}`));
      }
      console.log();
      console.log(chalk.gray(`    3. View all your albums at:`));
      console.log(chalk.cyan(`       https://rathnasorg.github.io/i4tow/p/${username}`));
      console.log();
    }

    process.exit(failed.length > 0 ? 1 : 0);
  });

program.parse();
