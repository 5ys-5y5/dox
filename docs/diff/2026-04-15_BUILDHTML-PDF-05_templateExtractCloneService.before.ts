import type {
  TemplateExtractAnalysisResult,
  TemplateExtractPair,
  TemplateExtractSourceKind,
} from '../lib/templateExtractDtos';
import { TemplateExtractDomProjectionService } from './templateExtractDomProjectionService';
import { TemplateExtractValueBindingService } from './templateExtractValueBindingService';

const buildAnalysisFromPairs = (pairs: TemplateExtractPair[]) =>
  TemplateExtractValueBindingService.buildCandidatesFromPairs(pairs);

export const TemplateExtractCloneService = {
  analyzeSource(
    sourceKind: TemplateExtractSourceKind,
    sourceTitle: string | null,
    sourceContent: string
  ): TemplateExtractAnalysisResult {
    const trimmedContent = sourceContent.trim();
    let pairs: TemplateExtractPair[] = [];
    let candidates = [] as TemplateExtractAnalysisResult['candidates'];
    let generatedDraftHtml = '';

    if (sourceKind === 'html') {
      const htmlProjection = TemplateExtractDomProjectionService.projectCloneHtml(trimmedContent);
      pairs = htmlProjection.pairs;
      candidates = htmlProjection.candidates;
      generatedDraftHtml = htmlProjection.generatedDraftHtml;

      if (pairs.length === 0) {
        const textFallback = buildAnalysisFromPairs(
          TemplateExtractValueBindingService.extractPairsFromText(
            TemplateExtractValueBindingService.stripHtml(trimmedContent)
          )
        );
        pairs = textFallback.pairs;
        candidates = textFallback.candidates;
        generatedDraftHtml = TemplateExtractDomProjectionService.buildFallbackDraftHtml(sourceTitle, pairs, candidates);
      }
    } else {
      const textFallback = buildAnalysisFromPairs(TemplateExtractValueBindingService.extractPairsFromText(trimmedContent));
      pairs = textFallback.pairs;
      candidates = textFallback.candidates;
      generatedDraftHtml = TemplateExtractDomProjectionService.buildFallbackDraftHtml(sourceTitle, pairs, candidates);
    }

    if (!generatedDraftHtml) {
      generatedDraftHtml = `<section data-template-extract-draft="true"><pre>${TemplateExtractValueBindingService.escapeHtml(
        trimmedContent
      )}</pre></section>`;
    }

    return {
      pairs,
      candidates,
      generatedDraftHtml,
      confidenceSummary: TemplateExtractValueBindingService.buildConfidenceSummary(candidates),
    };
  },
};
