import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

const home = homedir();
const configPath = resolve(home, '.codex', 'config.toml');
const configDir = dirname(configPath);
const profileDir = resolve(home, '.cache', 'chrome-llm-b');
const browserUrl = 'http://127.0.0.1:9223';
const chromeAppName = 'Google Chrome';

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const isBrowserReady = async () => {
  try {
    const response = await fetch(`${browserUrl}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
};

const startChrome = async () => {
  if (await isBrowserReady()) {
    console.log(`[split-chrome] Existing Chrome on ${browserUrl} is already ready.`);
    return true;
  }

  mkdirSync(profileDir, { recursive: true });

  const args = [
    '-n',
    '-a',
    chromeAppName,
    '--args',
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-popup-blocking',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=9223',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ];

  const child = spawn('/usr/bin/open', args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isBrowserReady()) {
      console.log(`[split-chrome] Separate Chrome is ready on ${browserUrl}.`);
      return true;
    }
    await sleep(1000);
  }

  return false;
};

const updateCodexConfig = () => {
  mkdirSync(configDir, { recursive: true });

  const existingContent = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';

  if (existsSync(configPath)) {
    const backupSuffix = new Date().toISOString().replaceAll(':', '-');
    const backupPath = `${configPath}.bak.${backupSuffix}`;
    copyFileSync(configPath, backupPath);
    console.log(`[split-chrome] Backup created: ${backupPath}`);
  }

  const desiredSection = [
    '[mcp_servers.chrome-devtools]',
    'command = "npx"',
    `args = ["-y", "chrome-devtools-mcp@latest", "--browser-url=${browserUrl}"]`,
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
  console.log(`[split-chrome] Updated: ${configPath}`);
};

const main = async () => {
  console.log('[split-chrome] Step 1/2: starting separate Chrome...');
  const started = await startChrome();

  if (!started) {
    console.error('');
    console.error('[split-chrome] Failed to confirm Chrome on http://127.0.0.1:9223.');
    console.error('[split-chrome] If Chrome did not open, run this in a normal macOS Terminal window:');
    console.error('');
    console.error(`  open -n -a "${chromeAppName}" --args --headless=new --remote-debugging-port=9223 --user-data-dir="${profileDir}" about:blank`);
    console.error('');
    process.exit(1);
  }

  console.log('[split-chrome] Step 2/2: updating Codex config...');
  updateCodexConfig();

  console.log('');
  console.log('[split-chrome] Done.');
  console.log('[split-chrome] Now close only this Codex CLI window and open it again.');
  console.log('[split-chrome] Do not close the other LLM window that is already using Chrome DevTools.');
};

main().catch((error) => {
  console.error('[split-chrome] Unexpected error:', error?.stack || error?.message || String(error));
  process.exit(1);
});
