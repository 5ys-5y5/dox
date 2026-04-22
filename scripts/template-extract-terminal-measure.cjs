const { mkdtempSync, rmSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const esbuild = require('esbuild');

const tempDir = mkdtempSync(join(tmpdir(), 'template-extract-terminal-measure-'));
const bundledFilePath = join(tempDir, 'template-extract-terminal-measure.cjs');

try {
  esbuild.buildSync({
    entryPoints: [join(process.cwd(), 'scripts/template-extract-terminal-measure-entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundledFilePath,
    logLevel: 'silent',
  });

  const result = spawnSync(process.execPath, [bundledFilePath, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  process.exit(result.status === null ? 1 : result.status);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
