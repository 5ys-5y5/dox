import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const managerPath = resolve(scriptDir, 'chrome_devtools_manager.mjs');

const result = spawnSync(process.execPath, [managerPath, 'setup', '--workspace', 'docs'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
