import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const home = homedir();
const configPath = resolve(home, '.codex', 'config.toml');
const configDir = dirname(configPath);

const updateCodexConfig = () => {
  mkdirSync(configDir, { recursive: true });

  const existingContent = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';

  if (existsSync(configPath)) {
    const backupSuffix = new Date().toISOString().replaceAll(':', '-');
    const backupPath = `${configPath}.bak.${backupSuffix}`;
    copyFileSync(configPath, backupPath);
    console.log(`[isolated-chrome] Backup created: ${backupPath}`);
  }

  const desiredSection = [
    '[mcp_servers.chrome-devtools]',
    'command = "npx"',
    'args = ["-y", "chrome-devtools-mcp@latest", "--isolated=true"]',
    'startup_timeout_ms = 20000',
  ].join('\n');

  const lines = existingContent.split(/\r?\n/);
  const nextLines = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (line.trim() === '[mcp_servers.chrome-devtools]') {
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (candidate.startsWith('[') && candidate.endsWith(']')) {
          break;
        }
        index += 1;
      }
      continue;
    }

    nextLines.push(line);
    index += 1;
  }

  let nextContent = nextLines.join('\n').trimEnd();
  if (nextContent.length > 0) {
    nextContent += '\n\n';
  }
  nextContent += `${desiredSection}\n`;

  writeFileSync(configPath, nextContent, 'utf8');
  console.log(`[isolated-chrome] Updated: ${configPath}`);
};

const main = () => {
  console.log('[isolated-chrome] Switching chrome-devtools MCP to --isolated=true...');
  updateCodexConfig();
  console.log('');
  console.log('[isolated-chrome] Done.');
  console.log('[isolated-chrome] Close only this Codex window and open it again.');
};

main();
