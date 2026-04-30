import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_VENV_DIRECTORY_NAMES = ['.venv-template-extract-v2', '.venv', 'venv', 'env'] as const;
const PYTHON_COMMAND_CANDIDATES = ['python3', 'python'] as const;
const pythonResolutionCache = new Map<string, string>();

const resolveVenvPythonPath = (venvRoot: string) =>
  process.platform === 'win32' ? join(venvRoot, 'Scripts', 'python.exe') : join(venvRoot, 'bin', 'python');

const isFileSystemPath = (candidate: string) =>
  candidate.includes('/') || candidate.includes('\\') || candidate.startsWith('.');

const pushUniqueCandidate = (candidates: string[], value: string | null | undefined) => {
  const normalized = String(value || '').trim();

  if (!normalized || candidates.includes(normalized)) {
    return;
  }

  if (isFileSystemPath(normalized) && !existsSync(normalized)) {
    return;
  }

  candidates.push(normalized);
};

const collectPythonCandidates = () => {
  const candidates: string[] = [];
  const activeVirtualEnv = process.env.VIRTUAL_ENV?.trim();
  const activeCondaEnv = process.env.CONDA_PREFIX?.trim();

  if (activeVirtualEnv) {
    pushUniqueCandidate(candidates, resolveVenvPythonPath(activeVirtualEnv));
  }

  if (activeCondaEnv) {
    pushUniqueCandidate(candidates, resolveVenvPythonPath(activeCondaEnv));
  }

  for (const directoryName of LOCAL_VENV_DIRECTORY_NAMES) {
    pushUniqueCandidate(candidates, resolveVenvPythonPath(join(process.cwd(), directoryName)));
  }

  for (const commandName of PYTHON_COMMAND_CANDIDATES) {
    pushUniqueCandidate(candidates, commandName);
  }

  return candidates;
};

const canResolveRequiredModules = (pythonBinary: string, requiredModules: string[]) => {
  if (!requiredModules.length) {
    return true;
  }

  const probeScript =
    `import importlib.util, sys; modules = ${JSON.stringify(requiredModules)}; ` +
    `missing = [name for name in modules if importlib.util.find_spec(name) is None]; ` +
    'raise SystemExit(0 if not missing else 1)';
  const result = spawnSync(pythonBinary, ['-c', probeScript], {
    stdio: 'ignore',
  });

  return result.status === 0;
};

export const resolveTemplateExtractPythonBinary = (requiredModules: string[] = []) => {
  const configuredPythonBinary = process.env.TEMPLATE_EXTRACT_PYTHON_BIN?.trim();

  if (configuredPythonBinary) {
    return configuredPythonBinary;
  }

  const normalizedRequiredModules = Array.from(
    new Set(requiredModules.map((value) => String(value || '').trim()).filter(Boolean))
  ).sort();
  const cacheKey = normalizedRequiredModules.join(',');
  const cached = pythonResolutionCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const candidates = collectPythonCandidates();
  const matched = candidates.find((candidate) => canResolveRequiredModules(candidate, normalizedRequiredModules));

  if (matched) {
    pythonResolutionCache.set(cacheKey, matched);
    return matched;
  }

  return candidates[0] || 'python3';
};

export const buildTemplateExtractPythonRuntimeHint = (pythonBinary: string) =>
  ` 사용 Python: ${pythonBinary}. 로컬에서는 TEMPLATE_EXTRACT_PYTHON_BIN, 활성 venv, 또는 .venv/.venv-template-extract-v2 Python을 사용할 수 있습니다. 필요하면 npm run template-extract:python:bootstrap 으로 추출용 venv를 준비하세요.`;
