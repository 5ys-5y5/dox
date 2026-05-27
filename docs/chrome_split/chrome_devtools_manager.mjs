import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

const home = homedir();
const stateDir = resolve(home, '.cache', 'chrome-devtools-workspaces');
const registryPath = resolve(stateDir, 'registry.json');
const codexConfigPath = resolve(home, '.codex', 'config.toml');

const defaultWorkspaces = {
  docs: {
    path: '/Users/gy/Documents/dev/docs',
    port: 9223,
  },
  mejai: {
    path: '/Users/gy/Documents/dev/mejai',
    port: 9224,
  },
};

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const parseArgs = (argv) => {
  const result = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }

    const raw = value.slice(2);
    const equalIndex = raw.indexOf('=');
    if (equalIndex !== -1) {
      result[raw.slice(0, equalIndex)] = raw.slice(equalIndex + 1);
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[raw] = true;
      continue;
    }

    result[raw] = next;
    index += 1;
  }

  return result;
};

const runText = (command, args) => new Promise((resolvePromise) => {
  let child;
  try {
    child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    resolvePromise('');
    return;
  }

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.on('close', () => resolvePromise(output));
  child.on('error', () => resolvePromise(''));
});

const parseProcessLine = (line) => {
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
  if (!match) return null;
  return {
    pid: Number(match[1]),
    ppid: Number(match[2]),
    rssKb: Number(match[3]),
    command: match[4],
  };
};

const readProcesses = async () => {
  const output = await runText('ps', ['-axo', 'pid=,ppid=,rss=,command=']);
  return output.split(/\r?\n/).map(parseProcessLine).filter(Boolean);
};

const readProcess = async (pid) => {
  const output = await runText('ps', ['-p', String(pid), '-o', 'pid=,ppid=,rss=,command=']);
  return output.split(/\r?\n/).map(parseProcessLine).filter(Boolean)[0] || null;
};

const readLsof = async (pid) => runText('lsof', ['-nP', '-p', String(pid)]);

const loadRegistry = () => {
  if (!existsSync(registryPath)) return {};
  try {
    return JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch {
    return {};
  }
};

const saveRegistry = (registry) => {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
};

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9_.-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'workspace';

const hashPort = (value) => {
  let hash = 0;
  for (const character of value) {
    hash = ((hash * 31) + character.charCodeAt(0)) % 400;
  }
  return 9300 + hash;
};

const resolveWorkspace = (options) => {
  const keyOrPath = options.workspace || options.w || options.path || process.cwd();
  const preset = defaultWorkspaces[keyOrPath];
  const workspacePath = resolve(options.path || preset?.path || keyOrPath);
  const name = slugify(options.name || options.workspace || (preset ? keyOrPath : basename(workspacePath)));
  const port = Number(options.port || preset?.port || hashPort(workspacePath));
  const profileDir = options.profile
    ? resolve(options.profile)
    : resolve(stateDir, 'profiles', name);
  const browserUrl = `http://127.0.0.1:${port}`;

  return {
    name,
    path: workspacePath,
    port,
    profileDir,
    browserUrl,
  };
};

const isBrowserReady = async (browserUrl) => {
  try {
    const response = await fetch(`${browserUrl}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
};

const readBrowserVersion = async (browserUrl) => {
  try {
    const response = await fetch(`${browserUrl}/json/version`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

const isChromeMainProcess = (command) => /\/Contents\/MacOS\/Google Chrome\s+--/.test(command)
  || /\/Contents\/MacOS\/Chromium\s+--/.test(command);

const extractUserDataDir = (command) => {
  const match = command.match(/--user-data-dir=("[^"]+"|'[^']+'|\S+)/);
  return match ? match[1].replace(/^['"]|['"]$/g, '') : null;
};

const findMatchingProcesses = async (workspace) => {
  const processes = await readProcesses();
  const portNeedle = `--remote-debugging-port=${workspace.port}`;
  const profileNeedle = `--user-data-dir=${workspace.profileDir}`;
  const browserUrlNeedles = [
    `--browser-url=${workspace.browserUrl}`,
    `--browser-url ${workspace.browserUrl}`,
  ];

  const browserProcesses = [];
  const mcpProcesses = [];
  const portProcesses = [];

  for (const processInfo of processes) {
    const command = processInfo.command || '';

    if (browserUrlNeedles.some((needle) => command.includes(needle))) {
      mcpProcesses.push(processInfo);
      continue;
    }

    if (command.includes(portNeedle)) {
      portProcesses.push(processInfo);
    }

    if (isChromeMainProcess(command) && (command.includes(portNeedle) || command.includes(profileNeedle))) {
      browserProcesses.push(processInfo);
    }
  }

  const browserPids = new Set(browserProcesses.map((processInfo) => processInfo.pid));
  const browserChildProcesses = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (const processInfo of processes) {
      if (browserPids.has(processInfo.pid)) continue;
      if (!browserPids.has(processInfo.ppid)) continue;

      browserPids.add(processInfo.pid);
      browserChildProcesses.push(processInfo);
      changed = true;
    }
  }

  return { browserProcesses, browserChildProcesses, mcpProcesses, portProcesses };
};

const startChrome = async (workspace, options) => {
  mkdirSync(workspace.profileDir, { recursive: true });

  if (await isBrowserReady(workspace.browserUrl)) {
    const matches = await findMatchingProcesses(workspace);
    const activeProfiles = [...new Set(matches.browserProcesses
      .map((processInfo) => extractUserDataDir(processInfo.command))
      .filter(Boolean))];
    const profileMatches = activeProfiles.length === 0 || activeProfiles.includes(workspace.profileDir);

    if (profileMatches || !options.replace) {
      console.log(`[chrome-manager] Reusing ready browser: ${workspace.browserUrl}`);
      if (!profileMatches) {
        console.log(`[chrome-manager] Profile warning: active=${activeProfiles.join(', ')} expected=${workspace.profileDir}`);
        console.log('[chrome-manager] Re-run with --replace to stop the existing debug browser on this port and start the workspace profile.');
      }
      return true;
    }

    console.log(`[chrome-manager] Replacing existing debug browser on ${workspace.browserUrl}`);
    for (const processInfo of [...matches.browserChildProcesses, ...matches.browserProcesses]) {
      killPid(processInfo.pid, 'SIGTERM');
    }
    await sleep(1500);
    if (options.force) {
      for (const processInfo of [...matches.browserChildProcesses, ...matches.browserProcesses]) {
        killPid(processInfo.pid, 'SIGKILL');
      }
      await sleep(500);
    }
  }

  const chromeArgs = [
    '-n',
    '-a',
    options.app || 'Google Chrome',
    '--args',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${workspace.port}`,
    `--user-data-dir=${workspace.profileDir}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-popup-blocking',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-file-access-from-files',
    'about:blank',
  ];

  if (!options.headed) {
    chromeArgs.splice(6, 0, '--headless=new', '--disable-gpu', '--hide-scrollbars');
  }

  console.log(`[chrome-manager] Starting ${workspace.name} browser on ${workspace.browserUrl}`);
  console.log(`[chrome-manager] Profile: ${workspace.profileDir}`);

  const child = spawn('/usr/bin/open', chromeArgs, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (await isBrowserReady(workspace.browserUrl)) {
      console.log(`[chrome-manager] Browser ready: ${workspace.browserUrl}`);
      return true;
    }
    await sleep(500);
  }

  console.error(`[chrome-manager] Browser did not become ready: ${workspace.browserUrl}`);
  return false;
};

const removeCodexChromeDevtoolsSections = (content) => {
  const lines = content.split(/\r?\n/);
  const nextLines = [];

  for (let index = 0; index < lines.length;) {
    const trimmed = lines[index].trim();
    const shouldRemove = trimmed === '[mcp_servers.chrome-devtools]'
      || trimmed.startsWith('[mcp_servers.chrome-devtools.');

    if (!shouldRemove) {
      nextLines.push(lines[index]);
      index += 1;
      continue;
    }

    index += 1;
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (candidate.startsWith('[') && candidate.endsWith(']')) break;
      index += 1;
    }
  }

  return nextLines.join('\n').trimEnd();
};

const updateCodexConfig = (workspace) => {
  mkdirSync(dirname(codexConfigPath), { recursive: true });
  const existingContent = existsSync(codexConfigPath) ? readFileSync(codexConfigPath, 'utf8') : '';

  if (existsSync(codexConfigPath)) {
    const backupSuffix = new Date().toISOString().replaceAll(':', '-');
    const backupPath = `${codexConfigPath}.bak.${backupSuffix}`;
    copyFileSync(codexConfigPath, backupPath);
    console.log(`[chrome-manager] Backup created: ${backupPath}`);
  }

  const section = [
    '[mcp_servers.chrome-devtools]',
    'command = "npx"',
    `args = ["-y", "chrome-devtools-mcp@latest", "--browser-url=${workspace.browserUrl}"]`,
    'startup_timeout_sec = 20.0',
  ].join('\n');

  let nextContent = removeCodexChromeDevtoolsSections(existingContent);
  if (nextContent.length > 0) nextContent += '\n\n';
  nextContent += `${section}\n`;

  writeFileSync(codexConfigPath, nextContent, 'utf8');
  console.log(`[chrome-manager] Codex chrome-devtools now uses ${workspace.browserUrl}`);
  console.log('[chrome-manager] Restart the target Codex CLI session after this change.');
};

const saveWorkspaceState = async (workspace) => {
  const registry = loadRegistry();
  const version = await readBrowserVersion(workspace.browserUrl);
  const matches = await findMatchingProcesses(workspace);

  registry[workspace.name] = {
    ...workspace,
    browserPid: matches.browserProcesses[0]?.pid || null,
    browserVersion: version?.Browser || null,
    updatedAt: new Date().toISOString(),
  };

  saveRegistry(registry);
};

const printStatus = async (workspace) => {
  const registry = loadRegistry();
  const saved = registry[workspace.name] || null;
  const version = await readBrowserVersion(workspace.browserUrl);
  const matches = await findMatchingProcesses(workspace);

  console.log(`Workspace: ${workspace.name}`);
  console.log(`Path: ${workspace.path}`);
  console.log(`Browser URL: ${workspace.browserUrl}`);
  console.log(`Profile: ${workspace.profileDir}`);
  console.log(`Ready: ${version ? 'yes' : 'no'}`);
  if (version) {
    console.log(`Browser: ${version.Browser || '-'}`);
    console.log(`WebSocket: ${version.webSocketDebuggerUrl || '-'}`);
  }
  if (saved) {
    console.log(`Saved browser PID: ${saved.browserPid || '-'}`);
    console.log(`Saved at: ${saved.updatedAt || '-'}`);
  }

  const activeProfiles = [...new Set(matches.browserProcesses
    .map((processInfo) => extractUserDataDir(processInfo.command))
    .filter(Boolean))];
  if (activeProfiles.length > 0) {
    console.log(`Active profile(s): ${activeProfiles.join(', ')}`);
    if (!activeProfiles.includes(workspace.profileDir)) {
      console.log(`Profile warning: port ${workspace.port} is occupied by a Chrome profile different from this workspace default.`);
    }
  }

  console.log('');
  console.log('Managed browser processes:');
  if (matches.browserProcesses.length === 0) {
    console.log('  - none found by port/profile');
  } else {
    for (const processInfo of matches.browserProcesses) {
      console.log(`  - PID ${processInfo.pid} PPID ${processInfo.ppid} RSS ${(processInfo.rssKb / 1024).toFixed(1)}MB`);
      console.log(`    ${processInfo.command}`);
    }
  }

  console.log('');
  console.log('Managed browser helper/renderer child processes:');
  if (matches.browserChildProcesses.length === 0) {
    console.log('  - none found by parent process');
  } else {
    for (const processInfo of matches.browserChildProcesses) {
      console.log(`  - PID ${processInfo.pid} PPID ${processInfo.ppid} RSS ${(processInfo.rssKb / 1024).toFixed(1)}MB`);
      console.log(`    ${processInfo.command}`);
    }
  }

  const nonMainPortProcesses = matches.portProcesses
    .filter((processInfo) => !matches.browserProcesses.some((browserProcess) => browserProcess.pid === processInfo.pid))
    .filter((processInfo) => !matches.browserChildProcesses.some((childProcess) => childProcess.pid === processInfo.pid));

  if (nonMainPortProcesses.length > 0) {
    console.log('');
    console.log('Other processes carrying this remote debugging port:');
    for (const processInfo of nonMainPortProcesses) {
      console.log(`  - PID ${processInfo.pid} PPID ${processInfo.ppid} RSS ${(processInfo.rssKb / 1024).toFixed(1)}MB`);
      console.log(`    ${processInfo.command}`);
    }
  }

  console.log('');
  console.log('MCP processes attached to this browser URL:');
  if (matches.mcpProcesses.length === 0) {
    console.log('  - none found by command line');
  } else {
    for (const processInfo of matches.mcpProcesses) {
      console.log(`  - PID ${processInfo.pid} PPID ${processInfo.ppid} RSS ${(processInfo.rssKb / 1024).toFixed(1)}MB`);
      console.log(`    ${processInfo.command}`);
    }
  }
};

const killPid = (pid, signal) => {
  try {
    process.kill(pid, signal);
    console.log(`[chrome-manager] ${signal} ${pid}`);
  } catch (error) {
    console.log(`[chrome-manager] Could not ${signal} ${pid}: ${error.message}`);
  }
};

const stopWorkspace = async (workspace, options) => {
  const matches = await findMatchingProcesses(workspace);
  const targets = [...matches.mcpProcesses];
  if (options.browser) targets.push(...matches.browserChildProcesses, ...matches.browserProcesses);

  if (targets.length === 0) {
    console.log('[chrome-manager] No matching managed processes found.');
    return;
  }

  console.log('[chrome-manager] Target processes:');
  for (const processInfo of targets) {
    console.log(`  - PID ${processInfo.pid} PPID ${processInfo.ppid} ${(processInfo.rssKb / 1024).toFixed(1)}MB ${processInfo.command}`);
  }

  if (!options.yes && !options.force) {
    console.log('');
    console.log('[chrome-manager] Dry run only. Re-run with --yes to terminate these PIDs.');
    console.log('[chrome-manager] Add --browser if you also want to stop the managed Chrome browser.');
    return;
  }

  for (const processInfo of targets) {
    killPid(processInfo.pid, 'SIGTERM');
  }

  if (options.force) {
    await sleep(1000);
    for (const processInfo of targets) {
      killPid(processInfo.pid, 'SIGKILL');
    }
  }
};

const inspectPid = async (pid) => {
  const processInfo = await readProcess(pid);
  if (!processInfo) {
    console.log(`PID ${pid}: not visible to ps, or already exited.`);
    return;
  }

  console.log(`PID: ${processInfo.pid}`);
  console.log(`PPID: ${processInfo.ppid}`);
  console.log(`RSS: ${(processInfo.rssKb / 1024).toFixed(1)}MB`);
  console.log(`Command: ${processInfo.command}`);

  const lsof = await readLsof(pid);
  const interesting = lsof
    .split(/\r?\n/)
    .filter((line) => /cwd|TCP|LISTEN|ESTABLISHED|chrome|devtools|node|npm|\.cache/i.test(line))
    .slice(0, 80);

  if (interesting.length > 0) {
    console.log('');
    console.log('Open files/ports excerpt:');
    for (const line of interesting) console.log(line);
  }
};

const bindPid = async (workspace, pid, options) => {
  const processInfo = await readProcess(pid);
  if (!processInfo) {
    console.error(`[chrome-manager] PID ${pid} is not visible.`);
    process.exit(1);
  }

  const portMatch = processInfo.command.match(/--remote-debugging-port=(\d+)/);
  const browserUrlMatch = processInfo.command.match(/--browser-url(?:=|\s+)(http:\/\/127\.0\.0\.1:(\d+))/);
  const profileMatch = processInfo.command.match(/--user-data-dir=("[^"]+"|'[^']+'|\S+)/);
  const explicitPort = options.port ? Number(options.port) : null;
  const boundPort = Number(portMatch?.[1] || browserUrlMatch?.[2] || explicitPort);

  if (!boundPort) {
    console.error('[chrome-manager] PID does not expose --remote-debugging-port or --browser-url in its command line.');
    console.error('[chrome-manager] MCP cannot attach directly to a PID; bind a Chrome debug browser PID or provide --port.');
    process.exit(1);
  }

  const boundWorkspace = {
    ...workspace,
    port: boundPort,
    browserUrl: `http://127.0.0.1:${boundPort}`,
    profileDir: profileMatch ? profileMatch[1].replace(/^['"]|['"]$/g, '') : workspace.profileDir,
  };

  const registry = loadRegistry();
  registry[boundWorkspace.name] = {
    ...boundWorkspace,
    browserPid: pid,
    boundFromPid: pid,
    updatedAt: new Date().toISOString(),
  };
  saveRegistry(registry);

  console.log(`[chrome-manager] Bound ${boundWorkspace.name} to PID ${pid} at ${boundWorkspace.browserUrl}`);
  updateCodexConfig(boundWorkspace);
};

const printLaunchCommand = (workspace) => {
  console.log(`cd ${JSON.stringify(workspace.path)}`);
  console.log([
    'codex',
    `-c ${JSON.stringify('mcp_servers.chrome-devtools.command="npx"')}`,
    `-c ${JSON.stringify(`mcp_servers.chrome-devtools.args=["-y","chrome-devtools-mcp@latest","--browser-url=${workspace.browserUrl}"]`)}`,
    '-c "mcp_servers.chrome-devtools.startup_timeout_sec=20.0"',
  ].join(' \\\n  '));
};

const printHelp = () => {
  console.log(`Usage:
  chrome_devtools_manager.mjs setup --workspace docs [--replace]
  chrome_devtools_manager.mjs setup --workspace mejai [--replace]
  chrome_devtools_manager.mjs start --workspace docs [--headed] [--replace]
  chrome_devtools_manager.mjs configure-codex --workspace docs
  chrome_devtools_manager.mjs status --workspace docs
  chrome_devtools_manager.mjs stop --workspace docs [--browser] [--yes] [--force]
  chrome_devtools_manager.mjs inspect --pid 12345
  chrome_devtools_manager.mjs bind-pid --workspace docs --pid 12345
  chrome_devtools_manager.mjs launch-command --workspace docs

Notes:
  - MCP attaches to a browser URL, not directly to a PID.
  - bind-pid accepts a Chrome debug browser PID and extracts its remote debugging port.
  - stop is a dry run unless --yes or --force is provided.
`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const command = options._[0] || 'help';

  if (command === 'help' || options.help) {
    printHelp();
    return;
  }

  if (command === 'inspect') {
    const pid = Number(options.pid || options._[1]);
    if (!pid) {
      console.error('[chrome-manager] inspect requires --pid <PID>.');
      process.exit(1);
    }
    await inspectPid(pid);
    return;
  }

  const workspace = resolveWorkspace(options);

  if (command === 'setup') {
    const ready = await startChrome(workspace, options);
    if (!ready) process.exit(1);
    updateCodexConfig(workspace);
    await saveWorkspaceState(workspace);
    await printStatus(workspace);
    return;
  }

  if (command === 'start') {
    const ready = await startChrome(workspace, options);
    if (!ready) process.exit(1);
    await saveWorkspaceState(workspace);
    await printStatus(workspace);
    return;
  }

  if (command === 'configure-codex') {
    updateCodexConfig(workspace);
    await saveWorkspaceState(workspace);
    return;
  }

  if (command === 'status') {
    await printStatus(workspace);
    return;
  }

  if (command === 'stop') {
    await stopWorkspace(workspace, options);
    return;
  }

  if (command === 'bind-pid') {
    const pid = Number(options.pid || options._[1]);
    if (!pid) {
      console.error('[chrome-manager] bind-pid requires --pid <PID>.');
      process.exit(1);
    }
    await bindPid(workspace, pid, options);
    return;
  }

  if (command === 'launch-command') {
    printLaunchCommand(workspace);
    return;
  }

  console.error(`[chrome-manager] Unknown command: ${command}`);
  printHelp();
  process.exit(1);
};

main().catch((error) => {
  console.error('[chrome-manager] Unexpected error:', error?.stack || error?.message || String(error));
  process.exit(1);
});
