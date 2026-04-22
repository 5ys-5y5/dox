import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  TemplateExtractEngineVersion,
  TemplateExtractVisualSimilarityReport,
} from '../lib/templateExtractDtos';

type MeasurementLogLevel = 'info' | 'warn' | 'error';

export type TemplateExtractMeasurementLogSession = {
  fileName: string;
  filePath: string;
};

export type TemplateExtractMeasurementLogStartInput = {
  draftId?: string | null;
  sourceTitle?: string | null;
  sourceFileName?: string | null;
  engineVersion?: TemplateExtractEngineVersion | 'unknown' | null;
};

export type TemplateExtractMeasurementLogAppendInput = {
  fileName: string;
  level?: MeasurementLogLevel;
  phase: string;
  percent?: number | null;
  stage?: string | null;
  detail?: string | null;
  payload?: unknown;
};

export type TemplateExtractMeasurementLogFinalizeInput = {
  fileName: string;
  status: 'completed' | 'failed';
  summary?: string | null;
  visualSimilarityReport?: TemplateExtractVisualSimilarityReport | null;
  errorMessage?: string | null;
};

const DOCS_DIR_NAME = 'docs';

const toTimestampToken = (date: Date) => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

const toFileToken = (value: string | null | undefined) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return 'unknown';
  }

  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-');
};

const toMarkdownJson = (value: unknown) => `\`\`\`json
${JSON.stringify(value, null, 2)}
\`\`\``;

const getDocsDirPath = () => join(process.cwd(), DOCS_DIR_NAME);

const resolveLogFilePath = (fileName: string) => {
  const normalizedFileName = toFileToken(fileName);

  if (!normalizedFileName.endsWith('.md') || !normalizedFileName.includes('template-extract-measurement')) {
    throw new Error('측정 로그 파일명이 올바르지 않습니다.');
  }

  return join(getDocsDirPath(), normalizedFileName);
};

const buildLogEntryMarkdown = (input: TemplateExtractMeasurementLogAppendInput) => {
  const timestamp = new Date().toISOString();
  const lines = [
    `### ${timestamp}`,
    '',
    `- level: ${input.level || 'info'}`,
    `- phase: ${input.phase}`,
    `- percent: ${typeof input.percent === 'number' ? input.percent : '-'}`,
    `- stage: ${(input.stage || '').trim() || '-'}`,
    `- detail: ${(input.detail || '').trim() || '-'}`,
  ];

  if (typeof input.payload !== 'undefined') {
    lines.push('', toMarkdownJson(input.payload));
  }

  lines.push('', '');
  return lines.join('\n');
};

export const TemplateExtractMeasurementLogService = {
  async startSession(
    input: TemplateExtractMeasurementLogStartInput
  ): Promise<TemplateExtractMeasurementLogSession> {
    const docsDirPath = getDocsDirPath();
    await mkdir(docsDirPath, { recursive: true });

    const timestampToken = toTimestampToken(new Date());
    const versionToken = toFileToken(input.engineVersion || 'unknown');
    const draftIdToken = toFileToken(input.draftId || 'no-draft');
    const fileName = `${timestampToken}_${versionToken}_template-extract-measurement_${draftIdToken}.md`;
    const filePath = join(docsDirPath, fileName);

    const markdown = `# Template Extract Visual Measurement Log

- startedAt: ${new Date().toISOString()}
- draftId: ${toFileToken(input.draftId || 'no-draft')}
- sourceTitle: ${(input.sourceTitle || '').trim() || '제목 없음'}
- sourceFileName: ${(input.sourceFileName || '').trim() || '파일 없음'}
- engineVersion: ${String(input.engineVersion || 'unknown').trim() || 'unknown'}

## Events

`;

    await writeFile(filePath, markdown, 'utf8');

    return {
      fileName,
      filePath,
    };
  },

  async appendEvent(input: TemplateExtractMeasurementLogAppendInput) {
    const filePath = resolveLogFilePath(input.fileName);
    await appendFile(filePath, buildLogEntryMarkdown(input), 'utf8');
  },

  async finalizeSession(input: TemplateExtractMeasurementLogFinalizeInput) {
    const filePath = resolveLogFilePath(input.fileName);
    const markdown = [
      '## Final Status',
      '',
      `- finishedAt: ${new Date().toISOString()}`,
      `- status: ${input.status}`,
      `- summary: ${(input.summary || '').trim() || '-'}`,
      `- errorMessage: ${(input.errorMessage || '').trim() || '-'}`,
      '',
      '### Visual Similarity Report',
      '',
      toMarkdownJson(input.visualSimilarityReport || null),
      '',
    ].join('\n');

    await appendFile(filePath, markdown, 'utf8');
  },
};
