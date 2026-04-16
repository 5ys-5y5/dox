import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'src', 'app');
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SHADOW_PATTERN = /shadow(?:-[A-Za-z0-9_[\]-]+|\[[^\]]+\])/g;

const shouldScanFile = (fileName) => {
  for (const extension of TARGET_EXTENSIONS) {
    if (fileName.endsWith(extension)) {
      return true;
    }
  }

  return false;
};

const collectFiles = async (directoryPath) => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && shouldScanFile(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
};

const findViolations = async () => {
  const files = await collectFiles(APP_DIR);
  const violations = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const matches = line.match(SHADOW_PATTERN);

      if (!matches) {
        return;
      }

      violations.push({
        filePath,
        lineNumber: index + 1,
        lineText: line.trim(),
        matches,
      });
    });
  }

  return violations;
};

const violations = await findViolations();

if (violations.length > 0) {
  console.error('APP-NOSHADOW-02 failed: src/app 에 shadow-* 클래스가 다시 들어갔습니다.');

  for (const violation of violations) {
    const relativePath = violation.filePath.replace(`${ROOT}/`, '');
    console.error(`- ${relativePath}:${violation.lineNumber}`);
    console.error(`  matches: ${violation.matches.join(', ')}`);
    console.error(`  line: ${violation.lineText}`);
  }

  process.exit(1);
}

console.log('APP-NOSHADOW-02 passed: src/app 에 shadow-* 클래스가 없습니다.');
