import type { TemplateExtractProjectionResult } from '../lib/templateExtractDtos';
import { TemplateExtractValueBindingService } from './templateExtractValueBindingService';

const TEMPLATE_VALUE_PATTERN =
  /<([a-z0-9:-]+)([^>]*?)\sdata-template-value="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi;
const ROW_PATTERN = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td([^>]*)>([\s\S]*?)<\/td>\s*<\/tr>/gi;

const mergeClassName = (rawAttrs: string, className: string) => {
  const classMatch = rawAttrs.match(/\sclass="([^"]*)"/i);

  if (!classMatch) {
    return `${rawAttrs} class="${className}"`;
  }

  const mergedClassName = `${classMatch[1]} ${className}`.trim().replace(/\s+/g, ' ');
  return rawAttrs.replace(/\sclass="[^"]*"/i, ` class="${mergedClassName}"`);
};

const buildPlaceholderInner = (
  labelKey: string,
  rawValueHtml: string,
  labelText: string
) => {
  const lineCount = rawValueHtml.match(/<(p|li)\b/gi)?.length || 0;

  if (/구분|전자서명 상태/.test(labelText)) {
    return `<span data-label="${labelKey}" data-template-placeholder="inline"></span>`;
  }

  if (rawValueHtml.includes('<ul') || rawValueHtml.includes('<li')) {
    return `<div class="template-clone__placeholder-list">
${Array.from({ length: Math.max(lineCount, 1) })
  .map(
    () =>
      `  <div class="template-clone__placeholder-line"><span data-label="${labelKey}" data-template-placeholder="line"></span></div>`
  )
  .join('\n')}
</div>`;
  }

  if (lineCount > 1) {
    return `<div class="template-clone__placeholder-block">
${Array.from({ length: lineCount })
  .map(
    () =>
      `  <p class="template-clone__placeholder-line"><span data-label="${labelKey}" data-template-placeholder="line"></span></p>`
  )
  .join('\n')}
</div>`;
  }

  return `<span data-label="${labelKey}" data-template-placeholder="inline"></span>`;
};

const buildTemplateValueReplacement = (
  tagName: string,
  leadingAttrs: string,
  trailingAttrs: string,
  labelKey: string,
  rawValueHtml: string,
  labelText: string
) => {
  const normalizedTag = tagName.toLowerCase();
  const cleanedAttrs = `${leadingAttrs || ''}${trailingAttrs || ''}`
    .replace(/\sdata-template-value="[^"]*"/gi, '')
    .replace(/\s+/g, ' ');

  if (/template-clone__pdf-mask/i.test(cleanedAttrs)) {
    const placeholderType = /template-clone__pdf-mask--block/i.test(cleanedAttrs) ? 'line' : 'inline';
    return `<${tagName}${cleanedAttrs}><span data-label="${labelKey}" data-template-placeholder="${placeholderType}"></span></${tagName}>`;
  }

  if (normalizedTag === 'p') {
    const placeholderClass = /template-clone__value-item/i.test(cleanedAttrs)
      ? 'template-clone__placeholder-item'
      : 'template-clone__placeholder-line';
    const placeholderType = /template-clone__value-item/i.test(cleanedAttrs) ? 'list-item' : 'line';

    return `<p${mergeClassName(cleanedAttrs, placeholderClass)}><span data-label="${labelKey}" data-template-placeholder="${placeholderType}"></span></p>`;
  }

  if (normalizedTag === 'li') {
    return `<li${mergeClassName(cleanedAttrs, 'template-clone__placeholder-item')}><span data-label="${labelKey}" data-template-placeholder="list-item"></span></li>`;
  }

  return `<${tagName}${cleanedAttrs}>${buildPlaceholderInner(labelKey, rawValueHtml, labelText)}</${tagName}>`;
};

const buildTableCellPlaceholder = (labelKey: string, rawValueHtml: string, labelText: string) => {
  const inline = buildPlaceholderInner(labelKey, rawValueHtml, labelText);

  if (inline.startsWith('<span')) {
    return `<div class="template-clone__placeholder-inline">${inline}</div>`;
  }

  return inline;
};

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

        if (!labelText) {
          return fullMatch;
        }

        const candidate =
          registry.registerPair(
            {
              labelText,
              valueText,
              valueHtml: rawValueHtml,
            },
            { allowKnownEmptyValue: true }
          ) ||
          (!valueText ? TemplateExtractValueBindingService.createKnownEmptyCandidate(labelText, registry.candidates.length + 1) : null);

        if (!candidate) {
          return fullMatch;
        }

        if (!registry.candidates.includes(candidate)) {
          registry.pairs.push({ labelText, valueText, valueHtml: rawValueHtml });
          registry.candidates.push(candidate);
        }

        return buildTemplateValueReplacement(
          tagName,
          leadingAttrs,
          trailingAttrs,
          candidate.labelKey,
          rawValueHtml,
          labelText
        );
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

        if (!labelText) {
          return fullMatch;
        }

        const candidate =
          registry.registerPair(
            {
              labelText,
              valueText,
              rowHtml: fullMatch,
              valueHtml: rawValueHtml,
            },
            { allowKnownEmptyValue: true }
          ) ||
          (!valueText ? TemplateExtractValueBindingService.createKnownEmptyCandidate(labelText, registry.candidates.length + 1) : null);

        if (!candidate) {
          return fullMatch;
        }

        if (!registry.candidates.includes(candidate)) {
          registry.pairs.push({
            labelText,
            valueText,
            rowHtml: fullMatch,
            valueHtml: rawValueHtml,
          });
          registry.candidates.push(candidate);
        }

        return `<tr><th>${rawLabelHtml}</th><td${tdAttrs}>${buildTableCellPlaceholder(
          candidate.labelKey,
          rawValueHtml,
          labelText
        )}</td></tr>`;
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

        return `<tr><th>${TemplateExtractValueBindingService.escapeHtml(pair.labelText)}</th><td>${buildTableCellPlaceholder(
          candidate.labelKey,
          pair.valueHtml || pair.valueText,
          pair.labelText
        )}</td></tr>`;
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
