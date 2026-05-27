import { execFileSync } from 'node:child_process';

const run = (command, args) => {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return error?.stdout?.toString() || '';
  }
};

const parseMemoryToKb = (value) => {
  const match = String(value).trim().match(/^([0-9.]+)([KMGTP]?)$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (!Number.isFinite(amount)) return 0;
  if (unit === 'T') return Math.round(amount * 1024 * 1024 * 1024);
  if (unit === 'G') return Math.round(amount * 1024 * 1024);
  if (unit === 'M') return Math.round(amount * 1024);
  return Math.round(amount);
};

const parseMetaLine = (line) => {
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s*(.*)$/);
  if (!match) return null;
  return {
    pid: Number(match[1]),
    ppid: Number(match[2]),
    pgid: Number(match[3]),
    sid: Number(match[4]),
    tty: match[5],
    stat: match[6],
    etime: match[7],
    rssKb: Number(match[8]),
    comm: match[9] || '-',
    command: '',
    commandName: '',
  };
};

const parsePidRestLine = (line) => {
  const match = line.match(/^\s*(\d+)\s*(.*)$/);
  if (!match) return null;
  return [Number(match[1]), match[2] || ''];
};

const parseSimpleProcessLine = (line) => {
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
  if (!match) return null;
  return {
    pid: Number(match[1]),
    ppid: Number(match[2]),
    pgid: 0,
    sid: 0,
    tty: '-',
    stat: '-',
    etime: '-',
    rssKb: Number(match[3]),
    comm: match[4],
    command: match[4],
    commandName: match[4].split(/\s+/)[0] || match[4],
  };
};

const requestedPids = [
  ...process.argv.slice(2),
  ...(process.env.PID || '').split(/[,\s]+/),
]
  .map((value) => Number(String(value).trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

const processMeta = run('ps', [
  '-axo',
  'pid=,ppid=,pgid=,sid=,tty=,stat=,etime=,rss=,comm=',
])
  .split(/\r?\n/)
  .map(parseMetaLine)
  .filter(Boolean);

const processCommands = new Map(
  run('ps', ['-axo', 'pid=,command='])
    .split(/\r?\n/)
    .map(parsePidRestLine)
    .filter(Boolean),
);

const processNames = new Map(
  run('ps', ['-axc', '-o', 'pid=,comm='])
    .split(/\r?\n/)
    .map(parsePidRestLine)
    .filter(Boolean),
);

const allProcesses = processMeta.map((processInfo) => ({
  ...processInfo,
  command: processCommands.get(processInfo.pid) || processInfo.comm || '',
  commandName: processNames.get(processInfo.pid) || processInfo.comm || '',
}));

const byPid = new Map(allProcesses.map((processInfo) => [processInfo.pid, processInfo]));

const readProcessByPid = (pid) => {
  const simple = run('ps', [
    '-p',
    String(pid),
    '-o',
    'pid=,ppid=,rss=,command=',
  ])
    .split(/\r?\n/)
    .map(parseSimpleProcessLine)
    .filter(Boolean)[0];
  if (!simple) return null;

  return {
    ...simple,
    command: simple.command || '',
    commandName: run('ps', ['-p', String(pid), '-o', 'comm=']).trim() || simple.commandName || '',
  };
};

const getParentChain = (processInfo) => {
  const chain = [];
  const seen = new Set([processInfo.pid]);
  let current = processInfo;

  while (current?.ppid && !seen.has(current.ppid) && chain.length < 16) {
    const parent = byPid.get(current.ppid);
    if (!parent) break;
    chain.push(parent);
    seen.add(parent.pid);
    current = parent;
  }

  return chain;
};

const readLsof = (pid) => run('lsof', ['-nP', '-p', String(pid)]);

const exactTargetPattern = /chrome-devtools-mcp|chrome-devtool\b|devtools-mcp|mcp.*chrome.*devtools|chrome.*devtools.*mcp/i;
const chromeDebugPattern = /--remote-debugging-port=9223|--remote-debugging-port=9222|chrome-llm-b|chrome-devtools-mcp\/chrome-profile/i;
const scriptPattern = /audit_chrome_devtools_processes\.mjs/;

const isExactTarget = (processInfo) => exactTargetPattern.test([
  processInfo.command,
  processInfo.commandName,
  processInfo.comm,
].join('\n'));

const isNodeLike = (processInfo) => /(^|\/)(node|npx|npm)(\s|$)|node_modules|\.npm\/_npx/i.test([
  processInfo.command,
  processInfo.commandName,
  processInfo.comm,
].join('\n'));

const exactTargets = allProcesses
  .filter(isExactTarget)
  .filter((processInfo) => !scriptPattern.test(processInfo.command));

const nodeCandidates = allProcesses
  .filter(isNodeLike)
  .filter((processInfo) => !scriptPattern.test(processInfo.command))
  .filter((processInfo) => !exactTargets.some((target) => target.pid === processInfo.pid));

const lsofCache = new Map();
const readCachedLsof = (pid) => {
  if (!lsofCache.has(pid)) {
    lsofCache.set(pid, readLsof(pid));
  }
  return lsofCache.get(pid);
};

const lsofTargetPattern = /chrome-devtools-mcp|\.cache\/chrome-devtools-mcp|chrome-llm-b|remote-debugging-port=9223/i;

const hiddenTargets = nodeCandidates.filter((processInfo) => (
  lsofTargetPattern.test(readCachedLsof(processInfo.pid))
));

const targetByPid = new Map();
for (const processInfo of [...exactTargets, ...hiddenTargets]) {
  targetByPid.set(processInfo.pid, processInfo);
}

const targetProcesses = [...targetByPid.values()].sort((left, right) => right.rssKb - left.rssKb);

const debugChromeProcesses = allProcesses
  .filter((processInfo) => chromeDebugPattern.test(processInfo.command))
  .filter((processInfo) => !scriptPattern.test(processInfo.command))
  .sort((left, right) => right.rssKb - left.rssKb);

const relatedNameProcesses = allProcesses
  .filter((processInfo) => /chrome|devtool|mcp/i.test([
    processInfo.command,
    processInfo.commandName,
    processInfo.comm,
  ].join('\n')))
  .filter((processInfo) => !scriptPattern.test(processInfo.command))
  .sort((left, right) => right.rssKb - left.rssKb);

const highMemoryNodeCandidates = allProcesses
  .filter(isNodeLike)
  .filter((processInfo) => !scriptPattern.test(processInfo.command))
  .sort((left, right) => right.rssKb - left.rssKb)
  .slice(0, 30);

const topSnapshot = run('top', ['-l', '1', '-o', 'mem', '-stats', 'pid,ppid,command,rsize', '-n', '30']).trim();

const topProcessCandidates = topSnapshot
  .split(/\r?\n/)
  .map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s+([0-9.]+[KMGTP]?)\s*$/i);
    if (!match) return null;
    return {
      pid: Number(match[1]),
      ppid: Number(match[2]),
      commandTitle: match[3].trim(),
      rssKb: parseMemoryToKb(match[4]),
    };
  })
  .filter(Boolean)
  .filter((candidate) => /node|chrome|devtool|mcp/i.test(candidate.commandTitle) || candidate.rssKb >= 512 * 1024)
  .filter((candidate) => !scriptPattern.test(candidate.commandTitle))
  .slice(0, 30);

const extractCwd = (lsofOutput) => {
  const cwdLine = lsofOutput
    .split(/\r?\n/)
    .find((line) => /\bcwd\b/.test(line));
  if (!cwdLine) return '-';
  const fields = cwdLine.trim().split(/\s+/);
  return fields.slice(8).join(' ') || '-';
};

const extractInterestingLsof = (lsofOutput) =>
  lsofOutput
    .split(/\r?\n/)
    .filter((line) => (
      /\bcwd\b/.test(line)
      || /TCP|LISTEN|ESTABLISHED/.test(line)
      || /chrome|devtools|\.cache|npm|node/i.test(line)
    ))
    .slice(0, 12);

const extractBrowserUrl = (command) => {
  const match = command.match(/--browser-url(?:=|\s+)(\S+)/);
  return match?.[1] || '-';
};

const classifyMode = (command) => {
  if (/--isolated(?:=true)?\b/.test(command)) return 'isolated';
  if (/--browser-url/.test(command)) return 'browser-url';
  return 'default';
};

const guessOwner = (chain) => {
  const text = chain.map((processInfo) => processInfo.command).join('\n');
  if (/Cursor/i.test(text)) return 'Cursor';
  if (/\bclaude\b/i.test(text)) return 'Claude';
  if (/\bgemini\b/i.test(text)) return 'Gemini';
  if (/\bcodex\b/i.test(text)) return 'Codex';
  if (/Terminal|iTerm/i.test(text)) return 'Terminal';
  return '-';
};

const makeHint = (processInfo, chain, owner, mode) => {
  if (processInfo.ppid === 1 || chain.length === 0) {
    return 'REVIEW: parent missing/launchd; often stale if no active LLM is using it';
  }
  if (owner !== '-') {
    return `KEEP if that ${owner} session is still active`;
  }
  if (mode === 'browser-url') {
    return 'KEEP if this is the one MCP attached to the shared debug browser';
  }
  return 'REVIEW: owner not obvious; inspect parent chain before killing';
};

const formatMb = (rssKb) => `${(rssKb / 1024).toFixed(1)}MB`;

const printProcessReport = (processInfo) => {
  const chain = getParentChain(processInfo);
  const owner = guessOwner(chain);
  const mode = classifyMode(processInfo.command);
  const browserUrl = extractBrowserUrl(processInfo.command);
  const lsofOutput = readCachedLsof(processInfo.pid);
  const cwd = extractCwd(lsofOutput);
  const hint = makeHint(processInfo, chain, owner, mode);

  console.log('='.repeat(100));
  console.log(`PID: ${processInfo.pid}`);
  console.log(`RSS: ${formatMb(processInfo.rssKb)}  ETIME: ${processInfo.etime}  STAT: ${processInfo.stat}  TTY: ${processInfo.tty}`);
  console.log(`Mode: ${mode}  Browser URL: ${browserUrl}  Owner guess: ${owner}`);
  console.log(`Process name: ${processInfo.commandName}`);
  console.log(`CWD: ${cwd}`);
  console.log(`Hint: ${hint}`);
  console.log(`Command: ${processInfo.command}`);

  console.log('\nParent chain:');
  if (chain.length === 0) {
    console.log('  - none visible');
  } else {
    for (const parent of chain) {
      console.log(`  - ${parent.pid} <- ${parent.command}`);
    }
  }

  const interestingLsof = extractInterestingLsof(lsofOutput);
  if (interestingLsof.length > 0) {
    console.log('\nOpen files/ports excerpt:');
    for (const line of interestingLsof) {
      console.log(`  ${line}`);
    }
  }

  console.log('');
};

if (requestedPids.length > 0) {
  for (const pid of requestedPids) {
    const processInfo = byPid.get(pid);
    if (!processInfo) {
      console.log(`PID ${pid}: not visible to ps, or already exited.`);
      continue;
    }
    printProcessReport(processInfo);
  }
  process.exit(0);
}

if (targetProcesses.length === 0) {
  console.log('No chrome-devtools-mcp processes found.');
  console.log('');
  console.log('Fallback diagnostics:');
  console.log('- Activity Monitor can show a process title that does not appear in the full command line.');
  console.log('- Compare the PID/RSS below with Activity Monitor, then inspect only the matching PID.');

  if (relatedNameProcesses.length > 0) {
    console.log('');
    console.log(`Processes with chrome/devtool/mcp in name or command (${Math.min(relatedNameProcesses.length, 30)} shown):`);
    for (const processInfo of relatedNameProcesses.slice(0, 30)) {
      const chain = getParentChain(processInfo);
      const owner = guessOwner(chain);
      console.log(`- PID ${processInfo.pid} PPID ${processInfo.ppid} RSS ${formatMb(processInfo.rssKb)} ETIME ${processInfo.etime} OWNER ${owner} NAME ${processInfo.commandName}`);
      console.log(`  ${processInfo.command}`);
    }
  }

  if (highMemoryNodeCandidates.length > 0) {
    console.log('');
    console.log(`High-memory Node/npx/npm candidates (${highMemoryNodeCandidates.length} shown):`);
    for (const processInfo of highMemoryNodeCandidates) {
      const chain = getParentChain(processInfo);
      const owner = guessOwner(chain);
      console.log(`- PID ${processInfo.pid} PPID ${processInfo.ppid} RSS ${formatMb(processInfo.rssKb)} ETIME ${processInfo.etime} OWNER ${owner} NAME ${processInfo.commandName}`);
      console.log(`  ${processInfo.command}`);
    }
  }

  if (debugChromeProcesses.length > 0) {
    console.log('');
    console.log(`Found ${debugChromeProcesses.length} Chrome debug browser process(es).`);
    console.log('This means the browser side may still be running, but no matching MCP node process is visible.');
    for (const processInfo of debugChromeProcesses.slice(0, 10)) {
      console.log(`- PID ${processInfo.pid} RSS ${formatMb(processInfo.rssKb)} ${processInfo.command}`);
    }
  }

  if (topProcessCandidates.length > 0) {
    console.log('');
    console.log('Top memory candidates re-inspected by PID:');
    for (const candidate of topProcessCandidates) {
      const processInfo = byPid.get(candidate.pid) || readProcessByPid(candidate.pid);
      if (!processInfo) {
        console.log(`- PID ${candidate.pid} PPID ${candidate.ppid} RSS ${formatMb(candidate.rssKb)} TOP_NAME ${candidate.commandTitle}: not visible to ps now`);
        continue;
      }
      const chain = getParentChain(processInfo);
      const owner = guessOwner(chain);
      console.log(`- PID ${processInfo.pid} PPID ${processInfo.ppid} RSS ${formatMb(processInfo.rssKb || candidate.rssKb)} ETIME ${processInfo.etime} OWNER ${owner} NAME ${processInfo.commandName}`);
      console.log(`  top: ${candidate.commandTitle}`);
      console.log(`  cmd: ${processInfo.command}`);
      if (processInfo.ppid === 1) {
        console.log('  hint: REVIEW orphan/launchd-owned process; likely stale if Activity Monitor says chrome-devtools-mcp and no active LLM owns it');
      }
    }
  }

  console.log('');
  console.log('Top memory snapshot from top(1):');
  console.log(topSnapshot || '(top output unavailable)');
  console.log('');
  console.log('To inspect a process shown in Activity Monitor, run one of these:');
  console.log('  ./docs/chrome_split/audit_chrome_devtools_processes.command <PID>');
  console.log('  PID=<PID> ./docs/chrome_split/audit_chrome_devtools_processes.command');
  process.exit(0);
}

console.log(`Found ${targetProcesses.length} chrome-devtools-mcp process(es).\n`);

for (const processInfo of targetProcesses) {
  printProcessReport(processInfo);
}

console.log('Suggested workflow:');
console.log('1. Keep processes whose parent chain points to an active LLM session you are using.');
console.log('2. Review processes with missing parents, old elapsed time, or unknown owner.');
console.log('3. Stop only confirmed stale PIDs with: kill <PID>');
console.log('4. Use kill -9 <PID> only if the same PID remains after a normal kill.');
