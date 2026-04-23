import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { formatTemplateExtractEngineVersionLabel } from '../src/lib/templateExtractDtos';
import { TemplateExtractCloneService } from '../src/services/templateExtractCloneService';
import { TemplateExtractLogService } from '../src/services/templateExtractLogService';
import { TemplateExtractMeasurementLogService } from '../src/services/templateExtractMeasurementLogService';
import { TemplateExtractPdfRenderService } from '../src/services/templateExtractPdfRenderService';
import { TemplateExtractReplicaRenderService } from '../src/services/templateExtractReplicaRenderService';
import { TemplateExtractVersionService } from '../src/services/templateExtractVersionService';

const parseArgs = (argv: string[]) => {
  const options: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      options[key] = 'true';
      continue;
    }

    options[key] = nextValue;
    index += 1;
  }

  return options;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const resolveFrameScore = (report: { frameScore?: number; overallScore: number }) =>
  typeof report.frameScore === 'number' ? report.frameScore : report.overallScore;

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const filePath = String(args.file || '').trim();
  const version = TemplateExtractVersionService.normalizeVersion(args.version || '32');
  const versionLabel = formatTemplateExtractEngineVersionLabel(version);
  const tolerancePx = Number.isFinite(Number(args.tolerancePx)) ? Math.max(0, Math.trunc(Number(args.tolerancePx))) : 1;
  const minimumPassScore = Number.isFinite(Number(args.minimumPassScore))
    ? Math.max(0, Math.min(1, Number(args.minimumPassScore)))
    : 0.95;

  if (!filePath) {
    throw new Error('사용법: npm run template-extract:measure -- --file <pdf-path> [--version v2.01] [--minimumPassScore 0.95]');
  }

  const fileName = basename(filePath);
  const bytes = new Uint8Array(await readFile(filePath));
  const draftId = `terminal-${Date.now()}`;
  const measurementSession = await TemplateExtractMeasurementLogService.startSession({
    draftId,
    sourceTitle: fileName.replace(/\.pdf$/i, '').trim() || fileName,
    sourceFileName: fileName,
    engineVersion: version,
  });

  try {
    await TemplateExtractMeasurementLogService.appendEvent({
      fileName: measurementSession.fileName,
      phase: 'resolving_source',
      percent: 5,
      stage: '터미널에서 PDF -> HTML 초안 생성을 시작했습니다.',
      detail: `${fileName} / engineVersion=${versionLabel}`,
      payload: { filePath, fileName, version, versionLabel },
    });

    const resolvedSource = await TemplateExtractVersionService.resolveUploadSource(
      fileName,
      'application/pdf',
      bytes,
      version
    );

    if (resolvedSource.sourceKind !== 'html') {
      throw new Error(`터미널 측정 실패: sourceKind=${resolvedSource.sourceKind} 이라 HTML 측정을 진행할 수 없습니다.`);
    }

    const analysis = TemplateExtractCloneService.analyzeSource(
      resolvedSource.sourceKind,
      resolvedSource.sourceTitle,
      resolvedSource.sourceContent
    );

    await TemplateExtractMeasurementLogService.appendEvent({
      fileName: measurementSession.fileName,
      phase: 'resolved_source',
      percent: 22,
      stage: 'PDF -> HTML 초안 생성을 완료했습니다.',
      detail: `cloneBuilder=${resolvedSource.pipelineTrace?.cloneBuilder || '-'} / htmlLength=${resolvedSource.sourceContent.length}`,
      payload: {
        sourceKind: resolvedSource.sourceKind,
        pipelineTrace: resolvedSource.pipelineTrace || null,
      },
    });

    const sourcePageImages = await TemplateExtractPdfRenderService.renderPageImages(fileName, bytes);

    await TemplateExtractMeasurementLogService.appendEvent({
      fileName: measurementSession.fileName,
      phase: 'rendering_pdf',
      percent: 48,
      stage: '원본 PDF 페이지 PNG 렌더를 완료했습니다.',
      detail: `pageCount=${sourcePageImages.length}`,
    });

    const measurement = await TemplateExtractReplicaRenderService.measureVisualSimilarity(
      resolvedSource.sourceContent,
      sourcePageImages,
      {
        tolerancePx,
        minimumPassScore,
      }
    );

    await TemplateExtractMeasurementLogService.finalizeSession({
      fileName: measurementSession.fileName,
      status: 'completed',
      summary: `1px 허용 오차 기준 프레임 중첩률 ${formatPercent(resolveFrameScore(measurement.visualSimilarityReport))}`,
      visualSimilarityReport: measurement.visualSimilarityReport,
    });

    const draftLog = await TemplateExtractLogService.writeDraftSummaryLog({
      draftId,
      sourceTitle: resolvedSource.sourceTitle,
      engineVersion: version,
      sourceKind: resolvedSource.sourceKind,
      outputHtml: resolvedSource.sourceContent,
      generatedDraftHtml: analysis.generatedDraftHtml,
      pipelineTrace: resolvedSource.pipelineTrace || null,
      qualityReport: resolvedSource.qualityReport || null,
      visualSimilarityReport: measurement.visualSimilarityReport,
    });

    console.log(JSON.stringify({
      success: true,
      fileName,
      version,
      versionLabel,
      cloneBuilder: resolvedSource.pipelineTrace?.cloneBuilder || null,
      overallScore: measurement.visualSimilarityReport.overallScore,
      overallScorePercent: formatPercent(measurement.visualSimilarityReport.overallScore),
      scoreMode: measurement.visualSimilarityReport.scoreMode || null,
      frameScore: measurement.visualSimilarityReport.frameScore ?? null,
      frameScorePercent:
        typeof measurement.visualSimilarityReport.frameScore === 'number'
          ? formatPercent(measurement.visualSimilarityReport.frameScore)
          : null,
      textScore: measurement.visualSimilarityReport.textScore ?? null,
      textScorePercent:
        typeof measurement.visualSimilarityReport.textScore === 'number'
          ? formatPercent(measurement.visualSimilarityReport.textScore)
          : null,
      combinedScore: measurement.visualSimilarityReport.combinedScore ?? null,
      combinedScorePercent:
        typeof measurement.visualSimilarityReport.combinedScore === 'number'
          ? formatPercent(measurement.visualSimilarityReport.combinedScore)
          : null,
      passed: measurement.visualSimilarityReport.passed,
      pageCount: measurement.visualSimilarityReport.pageCount,
      measurementLogFile: measurementSession.filePath,
      draftLogFile: draftLog.filePath,
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';

    await TemplateExtractMeasurementLogService.finalizeSession({
      fileName: measurementSession.fileName,
      status: 'failed',
      summary: '터미널 측정 실행 중 오류가 발생했습니다.',
      errorMessage: message,
      visualSimilarityReport: null,
    }).catch(() => undefined);

    throw error;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
