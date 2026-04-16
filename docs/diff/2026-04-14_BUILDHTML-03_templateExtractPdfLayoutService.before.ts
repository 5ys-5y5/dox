type PdfLabelDefinition = {
  canonical: string;
  aliases: string[];
};

type PdfMetadataField = {
  label: string;
  value: string;
};

type PdfSectionBlock = {
  number: string;
  label: string;
  valueLines: string[];
  asList: boolean;
};

type StructuredWorkOrder = {
  statusLines: string[];
  metadataFields: PdfMetadataField[];
  sections: PdfSectionBlock[];
  footerNotes: string[];
};

type ParsedStatusOverview = {
  ceName: string;
  ceProcessedAt: string;
  pmName: string;
  pmProcessedAt: string;
  issuerSignerName: string;
  issuerSignatureStatus: string;
  receiverSignerName: string;
};

const PDF_SECTION_DEFINITIONS: PdfLabelDefinition[] = [
  { canonical: '공사 내용', aliases: ['공 사 내 용', '공사 내용', '공사내용'] },
  { canonical: '대표수량 및 단가', aliases: ['대표수량 및 단가'] },
  { canonical: '하도급 대금', aliases: ['하도급 대금'] },
  { canonical: '공사착수일', aliases: ['공사착수일'] },
  { canonical: '공사완료일', aliases: ['공사완료일'] },
  { canonical: '검사의 방법', aliases: ['검사의 방법'] },
  { canonical: '검사의 시기', aliases: ['검사의 시기'] },
  { canonical: '대금 지급방법', aliases: ['대금 지급방법'] },
  { canonical: '대금 지급시기', aliases: ['대금 지급시기'] },
  { canonical: '원재료 지급시 조건', aliases: ['원재료 지급시 조건'] },
  {
    canonical: '공급원가 변동에 따른 하도급 대금의 조정',
    aliases: ['공급원가 변동에 따른 하도급 대금의 조정'],
  },
  { canonical: '특기사항', aliases: ['특기사항'] },
  { canonical: '첨부파일', aliases: ['첨부파일'] },
];

const PDF_SECTION_START_REGEX = /\d+(?:-\d+)?\.\s*[가-힣A-Za-z(]/g;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const cleanupPdfValue = (value: string) =>
  normalizeWhitespace(
    value
      .replace(/^[:\-\s]+/, '')
      .replace(/\s*\*+\s*/g, ' ')
      .replace(/\s+/g, ' ')
  );

const splitPdfLines = (rawText: string) =>
  rawText
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+(?=\d+(?:-\d+)?\.\s*[가-힣A-Za-z(])/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line && !/^---PAGE\s+\d+---$/i.test(line) && !/^-+\d+-+$/.test(line));

const matchSectionDefinition = (line: string) => {
  const headingMatch = line.match(/^(\d+(?:-\d+)?)\.\s*(.+)$/);

  if (!headingMatch) {
    return null;
  }

  const number = headingMatch[1];
  const remainder = normalizeWhitespace(headingMatch[2].replace(/\*/g, ''));

  for (const definition of PDF_SECTION_DEFINITIONS) {
    for (const alias of definition.aliases) {
      const aliasPattern = new RegExp(
        `^${alias.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')}(?:\\s+(.*))?$`
      );
      const matched = remainder.match(aliasPattern);

      if (matched) {
        return {
          number,
          label: definition.canonical,
          inlineValue: cleanupPdfValue(matched[1] || ''),
        };
      }
    }
  }

  return null;
};

const mergeWrappedSectionLines = (lines: string[]) => {
  const merged: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];

    if (!current || !next) {
      merged.push(current);
      continue;
    }

    if (!/^\d+(?:-\d+)?\.\s*/.test(current) || matchSectionDefinition(current)) {
      merged.push(current);
      continue;
    }

    const combined = normalizeWhitespace(`${current} ${next}`);

    if (matchSectionDefinition(combined)) {
      merged.push(combined);
      index += 1;
      continue;
    }

    merged.push(current);
  }

  return merged;
};

const expandCompoundSectionLines = (lines: string[]) =>
  lines.flatMap((line) => {
    const matches = Array.from(line.matchAll(PDF_SECTION_START_REGEX)).map((match) => ({
      index: match.index ?? -1,
    }));

    if (matches.length <= 1) {
      return [line];
    }

    return matches
      .map((match, index) =>
        normalizeWhitespace(line.slice(match.index, matches[index + 1]?.index ?? line.length))
      )
      .filter(Boolean);
  });

const parseMetadataLine = (line: string, metadataFields: PdfMetadataField[]) => {
  const pushField = (label: string, value: string) => {
    const cleanedValue = cleanupPdfValue(value);

    if (!cleanedValue) {
      return;
    }

    metadataFields.push({
      label,
      value: cleanedValue,
    });
  };

  let matched = line.match(/^양식명\(코드\)\s*:\s*(.+?)\s+문서번호\s*:\s*(.+)$/);

  if (matched) {
    pushField('양식명(코드)', matched[1]);
    pushField('양식 문서번호', matched[2]);
    return true;
  }

  matched = line.match(/^작\s*성\s*자\s+(.+)$/);

  if (matched) {
    pushField('작성자', matched[1]);
    return true;
  }

  matched = line.match(/^문\s*서\s*번\s*호\s+(.+?)\s+발\s*급\s*일\s+(.+?)(?:\s+협력사승인일\s*(.*))?$/);

  if (matched) {
    pushField('문서번호', matched[1]);
    pushField('발급일', matched[2]);
    if (matched[3]) {
      pushField('협력사승인일', matched[3]);
    }
    return true;
  }

  matched = line.match(/^프\s*로\s*젝\s*트\s+(.+?)\s+발\s*급\s*자\s+(.+)$/);

  if (matched) {
    pushField('프로젝트', matched[1]);
    pushField('발급자', matched[2]);
    return true;
  }

  matched = line.match(/^계\s*약\s+(.+?)\s+접\s*수\s*자\s+(.+)$/);

  if (matched) {
    pushField('계약', matched[1]);
    pushField('접수자', matched[2]);
    return true;
  }

  matched = line.match(/^제\s*목\s+(.+)$/);

  if (matched) {
    pushField('제목', matched[1]);
    return true;
  }

  return false;
};

const dedupeMetadataFields = (fields: PdfMetadataField[]) => {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = field.label.replace(/\s+/g, '').toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const parseStructuredWorkOrder = (rawText: string): StructuredWorkOrder | null => {
  const lines = mergeWrappedSectionLines(expandCompoundSectionLines(splitPdfLines(rawText)));
  const metadataFields: PdfMetadataField[] = [];
  const sections: PdfSectionBlock[] = [];
  const statusLines: string[] = [];
  const footerNotes: string[] = [];
  let currentSection: PdfSectionBlock | null = null;

  const flushSection = () => {
    if (!currentSection) {
      return;
    }

    const normalizedLines = currentSection.valueLines.map(cleanupPdfValue).filter(Boolean);

    if (normalizedLines.length > 0) {
      sections.push({
        ...currentSection,
        valueLines: normalizedLines,
      });
    }

    currentSection = null;
  };

  for (const line of lines) {
    const sectionMatch = matchSectionDefinition(line);

    if (sectionMatch) {
      flushSection();
      currentSection = {
        number: sectionMatch.number,
        label: sectionMatch.label,
        valueLines: sectionMatch.inlineValue ? [sectionMatch.inlineValue] : [],
        asList: sectionMatch.label === '첨부파일',
      };
      continue;
    }

    if (currentSection) {
      if (currentSection.label === '첨부파일' && /^※\s*/.test(line)) {
        footerNotes.push(line);
        continue;
      }

      currentSection.valueLines.push(line);
      continue;
    }

    if (parseMetadataLine(line, metadataFields)) {
      continue;
    }

    if (
      line === '구 분' ||
      line === '신규 재발급' ||
      line === 'Off-Line등록' ||
      /^CE\s+/i.test(line) ||
      /^PM\s+/i.test(line)
    ) {
      statusLines.push(line);
      continue;
    }

    if (/서명/.test(line) || /전자서명 완료/.test(line)) {
      statusLines.push(line);
      continue;
    }
  }

  flushSection();

  const dedupedMetadata = dedupeMetadataFields(metadataFields);

  if (dedupedMetadata.length < 4 || sections.length < 3) {
    return null;
  }

  return {
    statusLines,
    metadataFields: dedupedMetadata,
    sections,
    footerNotes,
  };
};

const parseStatusOverview = (statusLines: string[]): ParsedStatusOverview => {
  const overview: ParsedStatusOverview = {
    ceName: '',
    ceProcessedAt: '',
    pmName: '',
    pmProcessedAt: '',
    issuerSignerName: '',
    issuerSignatureStatus: '',
    receiverSignerName: '',
  };

  for (const line of statusLines) {
    let matched = line.match(/^CE\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/i);

    if (matched) {
      overview.ceName = cleanupPdfValue(matched[1]);
      overview.ceProcessedAt = cleanupPdfValue(matched[2]);
      continue;
    }

    matched = line.match(/^PM\s+(.+?)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/i);

    if (matched) {
      overview.pmName = cleanupPdfValue(matched[1]);
      overview.pmProcessedAt = cleanupPdfValue(matched[2]);
      continue;
    }

    matched = line.match(/^발급자 서명\s+(.+?)\s+(전자서명 완료)(?:\s+접수자 서명\s*(.*))?$/);

    if (matched) {
      overview.issuerSignerName = cleanupPdfValue(matched[1]);
      overview.issuerSignatureStatus = cleanupPdfValue(matched[2]);
      overview.receiverSignerName = cleanupPdfValue(matched[3] || '');
    }
  }

  return overview;
};

const buildStatusHtml = (statusLines: string[]) => {
  const overview = parseStatusOverview(statusLines);

  return `    <table class="template-clone__status-table">
      <colgroup>
        <col style="width: 10%">
        <col style="width: 23%">
        <col style="width: 10%">
        <col style="width: 23%">
        <col style="width: 10%">
        <col style="width: 24%">
      </colgroup>
      <tbody>
      <tr>
        <th>구분</th>
        <td colspan="5">
          <div class="template-clone__status-options">
            <span>□ 신규</span>
            <span>□ 재발급</span>
            <span>□ Off-Line 등록</span>
          </div>
        </td>
      </tr>
      <tr>
        <th>CE 담당자</th>
        <td><div data-template-value="CE 담당자">${escapeHtml(overview.ceName)}</div></td>
        <th>CE 처리시각</th>
        <td><div data-template-value="CE 처리시각">${escapeHtml(overview.ceProcessedAt)}</div></td>
      </tr>
      <tr>
        <th>PM 담당자</th>
        <td><div data-template-value="PM 담당자">${escapeHtml(overview.pmName)}</div></td>
        <th>PM 처리시각</th>
        <td><div data-template-value="PM 처리시각">${escapeHtml(overview.pmProcessedAt)}</div></td>
        <th>접수자 서명</th>
        <td><div data-template-value="접수자 서명">${escapeHtml(overview.receiverSignerName)}</div></td>
      </tr>
      <tr>
        <th>발급자 서명</th>
        <td><div data-template-value="발급자 서명자">${escapeHtml(overview.issuerSignerName)}</div></td>
        <th>전자서명 상태</th>
        <td colspan="3"><div data-template-value="전자서명 상태">${escapeHtml(overview.issuerSignatureStatus)}</div></td>
      </tr>
      </tbody>
    </table>`;
};

const buildMetadataHtml = (metadataFields: PdfMetadataField[]) => {
  const metadataByLabel = new Map(metadataFields.map((field) => [field.label, field.value]));
  const rows: string[] = [];

  const pushRow = (cells: Array<{ label: string; colSpan?: number }>) => {
    const cellHtml = cells
      .map((cell) => {
        const value = metadataByLabel.get(cell.label) || '';
        const colSpanAttr = cell.colSpan ? ` colspan="${cell.colSpan}"` : '';

        return `        <th>${escapeHtml(cell.label)}</th><td${colSpanAttr}><div data-template-value="${escapeHtml(
          cell.label
        )}">${escapeHtml(value)}</div></td>`;
      })
      .join('');

    rows.push(`      <tr>${cellHtml}</tr>`);
  };

  pushRow([{ label: '양식명(코드)' }, { label: '양식 문서번호' }]);
  pushRow([{ label: '작성자' }, { label: '문서번호' }, { label: '발급일' }, { label: '협력사승인일' }]);
  pushRow([{ label: '프로젝트' }, { label: '발급자' }]);
  pushRow([{ label: '계약' }, { label: '접수자' }]);
  pushRow([{ label: '제목', colSpan: 3 }]);

  return `    <table class="template-clone__meta-table">
      <colgroup>
        <col style="width: 12%">
        <col style="width: 19%">
        <col style="width: 12%">
        <col style="width: 19%">
        <col style="width: 12%">
        <col style="width: 13%">
        <col style="width: 13%">
      </colgroup>
      <tbody>
${rows.join('\n')}
      </tbody>
    </table>`;
};

const buildSectionLabelHtml = (section: PdfSectionBlock) => {
  if (section.label === '공급원가 변동에 따른 하도급 대금의 조정') {
    return `<div class="template-clone__section-label-stack">
          <span>공급원가 변동에 따른</span>
          <span>하도급 대금의 조정</span>
        </div>`;
  }

  return escapeHtml(section.label);
};

const buildSectionValueHtml = (section: PdfSectionBlock) => {
  if (section.asList) {
    return `<div class="template-clone__section-value template-clone__section-value--list">
        <ul>
${section.valueLines
  .map(
    (line) =>
      `          <li data-template-value="${escapeHtml(section.label)}">${escapeHtml(line)}</li>`
  )
  .join('\n')}
        </ul>
      </div>`;
  }

  return `<div class="template-clone__section-value">
${section.valueLines
  .map(
    (line) =>
      `        <p data-template-value="${escapeHtml(section.label)}">${escapeHtml(line)}</p>`
  )
  .join('\n')}
      </div>`;
};

const buildSectionsHtml = (sections: PdfSectionBlock[]) => {
  const rows = sections
    .map(
      (section) => `      <tr class="template-clone__body-row template-clone__body-row--${section.asList ? 'list' : 'text'}">
        <th class="template-clone__body-number">${escapeHtml(section.number)}.</th>
        <th class="template-clone__body-label">${buildSectionLabelHtml(section)}</th>
        <td class="template-clone__body-value">${buildSectionValueHtml(section)}</td>
      </tr>`
    )
    .join('\n');

  return `    <table class="template-clone__body-table">
      <colgroup>
        <col style="width: 6%">
        <col style="width: 24%">
        <col style="width: 70%">
      </colgroup>
      <tbody>
${rows}
      </tbody>
    </table>`;
};

const buildFooterHtml = (footerNotes: string[]) => {
  if (footerNotes.length === 0) {
    return '';
  }

  return `    <table class="template-clone__footer-table">
      <tbody>
        <tr>
          <td>
${footerNotes.map((line) => `            <p>${escapeHtml(line)}</p>`).join('\n')}
          </td>
        </tr>
      </tbody>
    </table>`;
};

export const TemplateExtractPdfLayoutService = {
  buildCloneHtml(sourceTitle: string, rawText: string) {
    const structured = parseStructuredWorkOrder(rawText);

    if (!structured) {
      return null;
    }

    return `<section data-template-extract-draft="true" data-template-clone="pdf-work-order">
  <div class="template-clone template-clone--pdf-work-order">
    <h1>작업지시서</h1>
${buildMetadataHtml(structured.metadataFields)}
${buildStatusHtml(structured.statusLines)}
${buildSectionsHtml(structured.sections)}
${buildFooterHtml(structured.footerNotes)}
  </div>
</section>`;
  },
};
