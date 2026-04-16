import type { TemplateExtractProjectionResult } from '../lib/templateExtractDtos';
import { TemplateExtractValueBindingService } from './templateExtractValueBindingService';

const TEMPLATE_VALUE_PATTERN =
  /<([a-z0-9:-]+)([^>]*?)\sdata-template-value="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi;
const ROW_PATTERN = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td([^>]*)>([\s\S]*?)<\/td>\s*<\/tr>/gi;

export const TemplateExtractDomProjectionService = {
  projectCloneHtml(sourceHtml: string): TemplateExtractProjectionResult {
    const registry = TemplateExtractValueBindingService.createProjectionRegistry();

    const cloneAwareHtml = sourceHtml.replace(
      TEMPLATE_VALUE_PATTERN,
      (
        fullMatch,
        tagName: string,
        leadingAttrs: string,
        rawLabel: string,
        trailingAttrs: string,
        rawValueHtml: string
      ) => {
        const labelText = TemplateExtractValueBindingService.decodeHtmlEntities(rawLabel).trim();
        const valueText = TemplateExtractValueBindingService.stripHtml(rawValueHtml);

        if (!labelText || !valueText) {
          return fullMatch;
        }

        const candidate = registry.registerPair(
          {
            labelText,
            valueText,
            valueHtml: rawValueHtml,
          },
          { allowKnownEmptyValue: true }
        );

        if (!candidate) {
          return fullMatch;
        }

        const cleanedAttrs = `${leadingAttrs || ''}${trailingAttrs || ''}`
          .replace(/\sdata-template-value="[^"]*"/gi, '')
          .replace(/\s+/g, ' ');

        return `<${tagName}${cleanedAttrs}><span data-label="${candidate.labelKey}"></span></${tagName}>`;
      }
    );

    const generatedDraftHtml = cloneAwareHtml.replace(
      ROW_PATTERN,
      (fullMatch, rawLabelHtml: string, tdAttrs: string, rawValueHtml: string) => {
        const thCount = (fullMatch.match(/<th\b/gi) || []).length;
        const tdCount = (fullMatch.match(/<td\b/gi) || []).length;

        if (thCount !== 1 || tdCount !== 1) {
          return fullMatch;
        }

        const labelText = TemplateExtractValueBindingService.stripHtml(rawLabelHtml);
        const valueText = TemplateExtractValueBindingService.stripHtml(rawValueHtml);

        if (!labelText || !valueText) {
          return fullMatch;
        }

        const candidate = registry.registerPair(
          {
            labelText,
            valueText,
            rowHtml: fullMatch,
            valueHtml: rawValueHtml,
          },
          { allowKnownEmptyValue: true }
        );

        if (!candidate) {
          return fullMatch;
        }

        return `<tr><th>${rawLabelHtml}</th><td${tdAttrs}><span data-label="${candidate.labelKey}"></span></td></tr>`;
      }
    );

    return {
      pairs: registry.pairs,
      candidates: registry.candidates,
      generatedDraftHtml,
    };
  },

  buildFallbackDraftHtml(
    sourceTitle: string | null,
    pairs: TemplateExtractProjectionResult['pairs'],
    candidates: TemplateExtractProjectionResult['candidates']
  ) {
    const rows = pairs
      .map((pair, index) => {
        const candidate = candidates[index];

        if (!candidate) {
          return '';
        }

        return `<tr><th>${TemplateExtractValueBindingService.escapeHtml(
          pair.labelText
        )}</th><td><span data-label="${candidate.labelKey}"></span></td></tr>`;
      })
      .filter(Boolean)
      .join('\n');

    return `<section data-template-extract-draft="true">
  <h1>${TemplateExtractValueBindingService.escapeHtml(sourceTitle?.trim() || '템플릿 추출 초안')}</h1>
  <table>
${rows}
  </table>
</section>`;
  },
};
