#!/usr/bin/env node

/**
 * check-mx-legacy.mjs
 *
 * Archive @MX:LEGACY tag checker and applier.
 *
 * biome-ignore lint/suspicious/noConsole: CLI script requires console.log for output
 *
 * Usage:
 *   node scripts/qa/check-mx-legacy.mjs              # Check mode (report missing tags)
 *   node scripts/qa/check-mx-legacy.mjs --fix        # Fix mode (apply @MX:LEGACY tags)
 *
 * Scope: archive/qms-pms/ directory (TypeScript/TSX files only)
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVE_DIR = 'archive/qms-pms';
const MX_LEGACY_PATTERN = /@MX:LEGACY/;
const HEADER_COMMENT_PATTERN = /^(\/\/.*|\/\*[\s\S]*?\*\/)\s*/;

/**
 * Check if a file has @MX:LEGACY tag
 */
function hasMXLegacyTag(content) {
  return MX_LEGACY_PATTERN.test(content);
}

/**
 * Find all TypeScript/TSX files in archive directory
 */
function findArchiveFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findArchiveFiles(fullPath, files);
    } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Apply @MX:LEGACY tag to file header
 */
function applyMXLegacyTag(filePath, content) {
  const lines = content.split('\n');

  // Find first non-empty line index
  let firstNonEmpty = 0;
  while (firstNonEmpty < lines.length && lines[firstNonEmpty].trim() === '') {
    firstNonEmpty++;
  }

  // Check if file already has a header comment
  const headerMatch = content.match(HEADER_COMMENT_PATTERN);
  let insertIndex = firstNonEmpty;

  if (headerMatch) {
    // Insert after existing header comment
    const headerEndIndex = content.indexOf(headerMatch[0]) + headerMatch[0].length;
    insertIndex = content.substring(0, headerEndIndex).split('\n').length;
  }

  // Construct @MX:LEGACY tag with source domain
  const relativePath = filePath.replace(/^archive\/qms-pms\//, '');
  const domain = relativePath.split('/')[0]; // First directory after qms-pms
  const tagLine = `// @MX:LEGACY archived from ${domain}`;

  // Insert tag at appropriate position
  lines.splice(insertIndex, 0, '', tagLine);

  return lines.join('\n');
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const fixMode = args.includes('--fix');

  if (!statSync(ARCHIVE_DIR).isDirectory()) {
    console.error(`Error: ${ARCHIVE_DIR} directory not found`);
    process.exit(1);
  }

  const files = findArchiveFiles(ARCHIVE_DIR);
  const missingTagFiles = [];

  // Check all files
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');

    if (!hasMXLegacyTag(content)) {
      missingTagFiles.push(file);
    }
  }

  // Report results
  console.log(`\n🔍 Archive @MX:LEGACY Tag Check (${ARCHIVE_DIR})`);
  console.log(`   Total TypeScript/TSX files: ${files.length}`);
  console.log(`   Files missing @MX:LEGACY tag: ${missingTagFiles.length}\n`);

  if (missingTagFiles.length > 0) {
    console.log('❌ Missing @MX:LEGACY tags:\n');
    for (const file of missingTagFiles) {
      console.log(`   - ${file}`);
    }
    console.log('');

    if (fixMode) {
      console.log('🔧 Applying @MX:LEGACY tags...\n');
      let applied = 0;

      for (const file of missingTagFiles) {
        const content = readFileSync(file, 'utf-8');
        const updated = applyMXLegacyTag(file, content);
        writeFileSync(file, updated, 'utf-8');
        applied++;
        console.log(`   ✓ ${file}`);
      }

      console.log(`\n✅ Applied @MX:LEGACY tags to ${applied} files\n`);
      process.exit(0);
    } else {
      console.log('💡 Run with --fix to apply missing tags\n');
      process.exit(1);
    }
  } else {
    console.log('✅ All archive files have @MX:LEGACY tags\n');
    process.exit(0);
  }
}

main();
