import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfPipelineTrace,
  TemplateExtractReplicaQualityReport,
} from '../lib/templateExtractDtos';

export type TemplateExtractDraftLogInput = {
  draftId: string;
  sourceTitle: string | null;
  engineVersion: TemplateExtractEngineVersion | 'unknown';
  sourceKind: 'html' | 'text';
  outputHtml: string;
  generatedDraftHtml?: string | null;
  pipelineTrace?: TemplateExtractPdfPipelineTrace | null;
  qualityReport?: TemplateExtractReplicaQualityReport | null;
};

export type TemplateExtractDraftLogResult = {
  fileName: string;
  filePath: string;
};

const toTimestampToken = (date: Date) => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

const toVersionToken = (engineVersion: TemplateExtractEngineVersion | 'unknown') => {
  const normalized = String(engineVersion || 'unknown').trim() || 'unknown';

  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-');
};

const toFileToken = (value: string) => {
  const normalized = value.trim();

  if (!normalized) {
    return 'unknown';
  }

  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-');
};

const toMarkdownJson = (value: unknown) => `\`\`\`json
${JSON.stringify(value, null, 2)}
\`\`\``;

const toMarkdownHtml = (value: string) => `\`\`\`html
${value}
\`\`\``;

const buildMeasurementNote = (qualityReport: TemplateExtractReplicaQualityReport | null | undefined) => {
  if (!qualityReport) {
    return '측정 결과가 없습니다.';
  }

  if (qualityReport.mode === 'offline') {
    return '현재 측정 결과는 PDF-HTML 렌더 일치 측정이 아니라 구조 휴리스틱입니다.';
  }

  return `측정 모드: ${qualityReport.mode}`;
};

export const TemplateExtractLogService = {
  async writeDraftSummaryLog(input: TemplateExtractDraftLogInput): Promise<TemplateExtractDraftLogResult> {
    const docsDirPath = join(process.cwd(), 'docs');
    await mkdir(docsDirPath, { recursive: true });

    const timestampToken = toTimestampToken(new Date());
    const versionToken = toVersionToken(input.engineVersion);
    const draftIdToken = toFileToken(input.draftId);
    const fileName = `${timestampToken}_${versionToken}_template-extract-log_${draftIdToken}.md`;
    const filePath = join(docsDirPath, fileName);

    const markdown = `# Template Extract Log

- generatedAt: ${new Date().toISOString()}
- draftId: ${input.draftId}
- sourceTitle: ${input.sourceTitle || '제목 없음'}
- engineVersion: ${input.engineVersion}
- sourceKind: ${input.sourceKind}
- measurementNote: ${buildMeasurementNote(input.qualityReport)}

## Pipeline Trace

${toMarkdownJson(input.pipelineTrace || null)}

## Visual Similarity Result

${toMarkdownJson(input.qualityReport || null)}

## Output HTML

${toMarkdownHtml(input.outputHtml)}

## Generated Draft HTML

${toMarkdownHtml((input.generatedDraftHtml || '').trim() || '<!-- generatedDraftHtml is empty -->')}
`;

    await writeFile(filePath, markdown, 'utf8');

    return {
      fileName,
      filePath,
    };
  },
};
