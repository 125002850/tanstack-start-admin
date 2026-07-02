#!/usr/bin/env node

/**
 * Frontend bundle budget gate.
 *
 * Defaults were measured from `dist` on 2026-07-01 and set to 120% of baseline:
 * - total: 9,269,972 bytes -> 11,123,967
 * - js total: 2,315,210 bytes -> 2,778,252
 * - css total: 202,721 bytes -> 243,266
 * - image total: 6,616,508 bytes -> 7,939,810
 * - largest js: 483,211 bytes -> 579,854
 * - largest css: 202,721 bytes -> 243,266
 * - largest image: 3,025,307 bytes -> 3,630,369
 *
 * Override with environment variables:
 * BUNDLE_BUDGET_TOTAL_BYTES, BUNDLE_BUDGET_JS_BYTES, BUNDLE_BUDGET_CSS_BYTES,
 * BUNDLE_BUDGET_IMAGE_BYTES, BUNDLE_BUDGET_MAX_JS_BYTES,
 * BUNDLE_BUDGET_MAX_CSS_BYTES, BUNDLE_BUDGET_MAX_IMAGE_BYTES,
 * BUNDLE_BUDGET_TOP_N.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';

const DEFAULT_BUDGETS = {
  totalBytes: 11_123_967,
  jsBytes: 2_778_252,
  cssBytes: 243_266,
  imageBytes: 7_939_810,
  maxJsBytes: 579_854,
  maxCssBytes: 243_266,
  maxImageBytes: 3_630_369
};

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const DIST_DIR = resolve(process.cwd(), process.argv[2] ?? 'dist');

function parseIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${raw}`);
  }

  return value;
}

function getBudgets() {
  return {
    totalBytes: parseIntegerEnv('BUNDLE_BUDGET_TOTAL_BYTES', DEFAULT_BUDGETS.totalBytes),
    jsBytes: parseIntegerEnv('BUNDLE_BUDGET_JS_BYTES', DEFAULT_BUDGETS.jsBytes),
    cssBytes: parseIntegerEnv('BUNDLE_BUDGET_CSS_BYTES', DEFAULT_BUDGETS.cssBytes),
    imageBytes: parseIntegerEnv('BUNDLE_BUDGET_IMAGE_BYTES', DEFAULT_BUDGETS.imageBytes),
    maxJsBytes: parseIntegerEnv('BUNDLE_BUDGET_MAX_JS_BYTES', DEFAULT_BUDGETS.maxJsBytes),
    maxCssBytes: parseIntegerEnv('BUNDLE_BUDGET_MAX_CSS_BYTES', DEFAULT_BUDGETS.maxCssBytes),
    maxImageBytes: parseIntegerEnv(
      'BUNDLE_BUDGET_MAX_IMAGE_BYTES',
      DEFAULT_BUDGETS.maxImageBytes
    )
  };
}

function collectFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
      continue;
    }

    if (entry.isFile()) {
      const size = statSync(path).size;
      files.push({
        path,
        relativePath: relative(DIST_DIR, path).replaceAll('\\', '/'),
        size,
        extension: extname(path).toLowerCase()
      });
    }
  }

  return files;
}

function sum(files) {
  return files.reduce((total, file) => total + file.size, 0);
}

function largest(files) {
  return files.toSorted((a, b) => b.size - a.size)[0];
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatAsset(file) {
  if (!file) {
    return '(none)';
  }

  return `${file.relativePath} ${formatBytes(file.size)}`;
}

function printTopAssets(label, files, topN) {
  console.log(`\nLargest ${label} assets:`);

  if (files.length === 0) {
    console.log('  (none)');
    return;
  }

  for (const file of files.toSorted((a, b) => b.size - a.size).slice(0, topN)) {
    console.log(`  ${formatAsset(file)}`);
  }
}

function assertBudget(failures, label, actual, budget) {
  const status = actual <= budget ? 'OK' : 'FAIL';
  console.log(`${status} ${label}: ${formatBytes(actual)} / ${formatBytes(budget)}`);

  if (actual > budget) {
    failures.push(`${label} exceeded: ${actual} > ${budget}`);
  }
}

function main() {
  if (!existsSync(DIST_DIR)) {
    throw new Error(`dist directory not found: ${DIST_DIR}`);
  }

  const budgets = getBudgets();
  const topN = parseIntegerEnv('BUNDLE_BUDGET_TOP_N', 8);
  const files = collectFiles(DIST_DIR);
  const jsFiles = files.filter((file) => file.extension === '.js');
  const cssFiles = files.filter((file) => file.extension === '.css');
  const imageFiles = files.filter((file) => IMAGE_EXTENSIONS.has(file.extension));

  const metrics = {
    totalBytes: sum(files),
    jsBytes: sum(jsFiles),
    cssBytes: sum(cssFiles),
    imageBytes: sum(imageFiles),
    maxJsBytes: largest(jsFiles)?.size ?? 0,
    maxCssBytes: largest(cssFiles)?.size ?? 0,
    maxImageBytes: largest(imageFiles)?.size ?? 0
  };
  const failures = [];

  console.log(`Bundle budget report for ${relative(process.cwd(), DIST_DIR) || DIST_DIR}`);
  console.log(`Files scanned: ${files.length}`);
  assertBudget(failures, 'total bytes', metrics.totalBytes, budgets.totalBytes);
  assertBudget(failures, 'js bytes', metrics.jsBytes, budgets.jsBytes);
  assertBudget(failures, 'css bytes', metrics.cssBytes, budgets.cssBytes);
  assertBudget(failures, 'image bytes', metrics.imageBytes, budgets.imageBytes);
  assertBudget(failures, 'largest js asset', metrics.maxJsBytes, budgets.maxJsBytes);
  assertBudget(failures, 'largest css asset', metrics.maxCssBytes, budgets.maxCssBytes);
  assertBudget(failures, 'largest image asset', metrics.maxImageBytes, budgets.maxImageBytes);

  printTopAssets('JS', jsFiles, topN);
  printTopAssets('CSS', cssFiles, topN);
  printTopAssets('image', imageFiles, topN);

  if (failures.length > 0) {
    console.error('\nBundle budget failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
