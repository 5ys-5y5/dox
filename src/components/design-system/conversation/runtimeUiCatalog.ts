import { formatMoneyToken } from "@/lib/formatters/structuredDisplay";

export type RuntimePromptKind =
  | "lead_day"
  | "intent_disambiguation"
  | "restock_product_choice"
  | "restock_subscribe_confirm"
  | "restock_subscribe_phone"
  | "restock_post_subscribe"
  | "restock_alternative_confirm"
  | null;

export type RuntimeUiTypeId =
  | "text.default"
  | "text.structured_table"
  | "choice.generic"
  | "choice.lead_day"
  | "choice.intent_disambiguation"
  | "cards.generic"
  | "cards.restock_product_choice";

export const RUNTIME_UI_TYPE_IDS: RuntimeUiTypeId[] = [
  "text.default",
  "text.structured_table",
  "choice.generic",
  "choice.lead_day",
  "choice.intent_disambiguation",
  "cards.generic",
  "cards.restock_product_choice",
];

export const RUNTIME_UI_TYPE_HIERARCHY: ReadonlyArray<{
  parent: "text" | "choice" | "cards";
  children: RuntimeUiTypeId[];
}> = [
  { parent: "text", children: ["text.default", "text.structured_table"] },
  { parent: "choice", children: ["choice.generic", "choice.lead_day", "choice.intent_disambiguation"] },
  { parent: "cards", children: ["cards.generic", "cards.restock_product_choice"] },
] as const;

export const RUNTIME_UI_PROMPT_RULES = {
  leadDayPromptKeyword: "예약 알림일을 선택해 주세요",
  intentDisambiguationKeywords: ["의도 확인", "복수 선택 가능"],
  minSelectRegex: /최소\s*(\d+)/,
  criteriaMap: {
    lead_day: ["ASK_RESTOCK_SUBSCRIBE_LEAD_DAYS", "restock_subscribe_lead_days"],
    intent_disambiguation: ["ASK_INTENT_DISAMBIGUATION", "intent_disambiguation"],
    restock_product_choice: ["ASK_RESTOCK_PRODUCT_CHOICE", "restock_product_choice", "not_in_target_fallback_choice"],
    restock_subscribe_confirm: ["ASK_RESTOCK_SUBSCRIBE_CONFIRM", "awaiting_subscribe_confirm"],
    restock_subscribe_phone: ["ASK_RESTOCK_SUBSCRIBE_PHONE", "awaiting_subscribe_phone"],
    restock_post_subscribe: ["post_subscribe_next_step"],
    restock_alternative_confirm: ["ASK_ALTERNATIVE_RESTOCK_TARGET_CONFIRM", "awaiting_non_target_alternative_confirm"],
  },
} as const;

type RuntimeStructuredRowKind = "numbered_pipe" | "pipe" | "price_pair" | "date_pair" | "single";

type RuntimeStructuredRow = {
  index?: string | null;
  cells: string[];
  kind: RuntimeStructuredRowKind;
};

type RuntimeNumberedPipeRow = RuntimeStructuredRow & {
  index: string;
  kind: "numbered_pipe";
};

type RuntimeStructuredTableSpec = {
  title: string;
  headers: string[];
  rows: RuntimeStructuredRow[];
  example?: string;
  uiTypeId: RuntimeUiTypeId;
  detectionReason: string;
};

export type RuntimeRichMessagePresentation = {
  html: string;
  uiTypeId: RuntimeUiTypeId;
  detectionReason: string;
};

const BULLET_PREFIX_REGEX = /^(?:[-*•]\s+)+/;
const DATE_TOKEN_REGEX = /^(?:\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|D-\d+)$/;
const PRICE_TOKEN_REGEX = /^\d[\d,]*\s*원$/;
const NUMBERED_PIPE_ROW_REGEX = /^-\s*(\d{1,2})\s*(?:번)?\s*\|\s*(.+)$/;
const THREE_PHASE_CONFIRMED_PREFIX = "확인한 것:";
const THREE_PHASE_CONFIRMING_PREFIX = "확인할 것:";
const THREE_PHASE_NEXT_PREFIX = "그 다음으로 확인할 것:";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractConfirmingSegment(message: string) {
  const lines = String(message || "").split(/\r?\n/);
  const confirming: string[] = [];
  let inConfirming = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith(THREE_PHASE_CONFIRMED_PREFIX)) {
      inConfirming = false;
      continue;
    }
    if (line.startsWith(THREE_PHASE_CONFIRMING_PREFIX)) {
      inConfirming = true;
      const content = line.slice(THREE_PHASE_CONFIRMING_PREFIX.length).trim();
      if (content) confirming.push(content);
      continue;
    }
    if (line.startsWith(THREE_PHASE_NEXT_PREFIX)) {
      if (inConfirming) break;
      inConfirming = false;
      continue;
    }
    if (inConfirming && line) {
      confirming.push(line);
    }
  }

  return confirming.length > 0 ? confirming.join("\n") : message;
}

function normalizeLines(message: unknown) {
  const extracted = extractConfirmingSegment(typeof message === "string" ? message : "");
  return extracted
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripBulletPrefix(line: string) {
  return line.replace(BULLET_PREFIX_REGEX, "").trim();
}

function isExampleLine(line: string) {
  return /^예\s*:/.test(line);
}

function parseIntentDisambiguationTable(lines: string[]): RuntimeStructuredTableSpec | null {
  if (lines.length < 2) return null;
  const title = lines[0] || "";
  const rows = lines.flatMap<RuntimeNumberedPipeRow>((line) => {
      const match = line.match(NUMBERED_PIPE_ROW_REGEX);
      if (!match) return [];
      const index = match[1];
      const cells = String(match[2] || "")
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);
      if (cells.length === 0) return [];
      return [{
        index,
        cells,
        kind: "numbered_pipe" as const,
      }];
    });
  if (rows.length === 0) return null;
  const example = lines.find((line) => isExampleLine(line));
  return {
    title,
    headers: rows.some((row) => row.cells.length > 1) ? ["문의 유형", "지원 범위"] : ["문의 유형"],
    rows,
    example: example ? example.replace(/^예\s*:\s*/, "").trim() : undefined,
    uiTypeId: "choice.intent_disambiguation",
    detectionReason: "numbered_pipe_rows",
  };
}

function parseGenericStructuredRow(rawLine: string): RuntimeStructuredRow | null {
  const line = stripBulletPrefix(rawLine);
  if (!line || isExampleLine(line)) return null;
  if (NUMBERED_PIPE_ROW_REGEX.test(rawLine)) return null;

  const pipeCells = line
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (pipeCells.length >= 2) {
    return {
      cells: pipeCells,
      kind: "pipe",
    };
  }

  const priceMatch = line.match(/^(.+?)\s+(\d[\d,]*\s*원)$/);
  if (priceMatch) {
    return {
      cells: [priceMatch[1].trim(), priceMatch[2].trim()],
      kind: "price_pair",
    };
  }

  const dateMatch = line.match(/^(.+?)\s+((?:\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|D-\d+))$/);
  if (dateMatch) {
    return {
      cells: [dateMatch[1].trim(), dateMatch[2].trim()],
      kind: "date_pair",
    };
  }

  if (!/[.!?]$/.test(line) && line.length <= 40) {
    return {
      cells: [line],
      kind: "single",
    };
  }

  return null;
}

function resolveGenericHeaders(rows: RuntimeStructuredRow[]) {
  const firstWidth = rows[0]?.cells.length || 0;
  if (firstWidth <= 1) return ["항목"];
  if (rows.every((row) => row.kind === "price_pair")) return ["회차", "가격"];
  if (rows.every((row) => row.kind === "date_pair")) return ["항목", "일정"];
  if (firstWidth === 2) {
    const lastCells = rows.map((row) => row.cells[1] || "");
    if (lastCells.every((cell) => PRICE_TOKEN_REGEX.test(cell))) return ["구분", "가격"];
    if (lastCells.every((cell) => DATE_TOKEN_REGEX.test(cell))) return ["항목", "일정"];
    return ["항목", "내용"];
  }
  return Array.from({ length: firstWidth }, (_, idx) => `열${idx + 1}`);
}

function formatStructuredCell(cell: string, row: RuntimeStructuredRow, columnIndex: number) {
  const isLastColumn = columnIndex === row.cells.length - 1;
  if (row.kind === "price_pair" && isLastColumn) {
    return formatMoneyToken(cell);
  }
  if (isLastColumn && PRICE_TOKEN_REGEX.test(cell)) {
    return formatMoneyToken(cell);
  }
  return cell;
}

function parseGenericStructuredTable(lines: string[]): RuntimeStructuredTableSpec | null {
  if (lines.length < 3) return null;
  const title = lines[0] || "";
  const example = lines.find((line, idx) => idx > 0 && isExampleLine(line));
  const bodyLines = lines.slice(1).filter((line) => !isExampleLine(line));
  if (bodyLines.length < 2) return null;

  const rows: RuntimeStructuredRow[] = [];
  for (const line of bodyLines) {
    const parsed = parseGenericStructuredRow(line);
    if (!parsed) return null;
    rows.push(parsed);
  }
  if (rows.length < 2) return null;

  const columnWidth = rows[0]?.cells.length || 0;
  if (columnWidth === 0) return null;
  if (!rows.every((row) => row.cells.length === columnWidth)) return null;

  const headers = resolveGenericHeaders(rows);
  const detectionReason = rows.every((row) => row.kind === "price_pair")
    ? "price_rows"
    : rows.every((row) => row.kind === "date_pair")
      ? "date_rows"
      : rows.every((row) => row.kind === "pipe")
        ? "pipe_rows"
        : "structured_rows";

  return {
    title,
    headers,
    rows,
    example: example ? example.replace(/^예\s*:\s*/, "").trim() : undefined,
    uiTypeId: "text.structured_table",
    detectionReason,
  };
}

function buildTableHtml(spec: RuntimeStructuredTableSpec) {
  const hasIndex = spec.rows.some((row) => String(row.index || "").trim() !== "");
  const clampStyle = "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;";
  const headerCellStyle =
    "padding:4px 6px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:10px;text-align:left;";
  const primaryCellStyle = "padding:4px 6px;border-bottom:1px solid #e2e8f0;line-height:1.35;color:inherit;font-size:12px;";
  const secondaryCellStyle = "padding:4px 6px;border-bottom:1px solid #e2e8f0;line-height:1.35;color:#475569;font-size:11px;";
  const shouldForceScroll =
    hasIndex ||
    spec.headers.length >= 3 ||
    spec.rows.some((row) => row.cells.some((cell) => cell.length >= 18));

  const headerCells = [
    hasIndex
      ? `<th style="padding:4px 6px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:10px;text-align:center;width:42px;">번호</th>`
      : "",
    ...spec.headers.map((header, idx) => {
      const extraStyle = idx === spec.headers.length - 1 && spec.headers.length >= 2 ? "width:110px;" : "";
      return `<th style="${headerCellStyle}${extraStyle}">${escapeHtml(header)}</th>`;
    }),
  ]
    .filter(Boolean)
    .join("");

  const rowsHtml = spec.rows
    .map((row) => {
      const indexCell = hasIndex
        ? `<td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:center;color:#0f172a;font-size:11px;font-weight:700;white-space:nowrap;">${escapeHtml(
            String(row.index || "")
          )}</td>`
        : "";
      const dataCells = row.cells
        .map((cell, idx) => {
          const style = idx === 0 ? primaryCellStyle : secondaryCellStyle;
          const displayCell = formatStructuredCell(cell, row, idx);
          return `<td style="${style}max-width:${row.cells.length >= 2 ? "50%" : "100%"};"><div style="${clampStyle}">${escapeHtml(
            displayCell
          )}</div></td>`;
        })
        .join("");
      return `<tr>${indexCell}${dataCells}</tr>`;
    })
    .join("");

  const exampleHtml = spec.example
    ? `<div style="margin-top:8px;color:inherit;"><strong>예시</strong>: ${escapeHtml(spec.example)}</div>`
    : "";

  return `<div style="display:block;margin:0;padding:0;color:inherit;font:inherit;line-height:inherit;"><style>[data-mejai-scroll-area]{scrollbar-width:none;-ms-overflow-style:none;}[data-mejai-scroll-area]::-webkit-scrollbar{display:none;}</style><div style="margin:0;padding:0;color:inherit;font:inherit;line-height:inherit;">${escapeHtml(
    spec.title
  )}</div><div data-mejai-scroll-table="1" style="margin-top:4px;position:relative;overflow:hidden;border:1px solid #e2e8f0;border-radius:8px;background:rgba(255,255,255,0.55);"><div data-mejai-scroll-left="1" style="position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center;opacity:0;transition:opacity .2s ease;pointer-events:none;padding-left:4px;padding-right:6px;background:linear-gradient(90deg,rgba(255,255,255,0.92),rgba(255,255,255,0));"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></div><div data-mejai-scroll-right="1" style="position:absolute;right:0;top:0;bottom:0;display:flex;align-items:center;opacity:0;transition:opacity .2s ease;pointer-events:none;padding-right:4px;padding-left:6px;background:linear-gradient(270deg,rgba(255,255,255,0.92),rgba(255,255,255,0));"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div><div data-mejai-scroll-area="1" style="overflow-x:auto;overflow-y:hidden;padding:0;scrollbar-width:none;"><table style="width:max-content;min-width:${shouldForceScroll ? "calc(100% + 64px)" : "100%"};border-collapse:collapse;table-layout:auto;color:inherit;font:inherit;margin:0;"><thead><tr>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table></div></div>${exampleHtml}</div>`;
}

export function resolveRuntimeRichMessagePresentationFromText(message: unknown): RuntimeRichMessagePresentation | null {
  const lines = normalizeLines(message);
  if (lines.length < 2) return null;

  const disambiguation = parseIntentDisambiguationTable(lines);
  if (disambiguation) {
    return {
      html: buildTableHtml(disambiguation),
      uiTypeId: disambiguation.uiTypeId,
      detectionReason: disambiguation.detectionReason,
    };
  }

  const generic = parseGenericStructuredTable(lines);
  if (generic) {
    return {
      html: buildTableHtml(generic),
      uiTypeId: generic.uiTypeId,
      detectionReason: generic.detectionReason,
    };
  }

  return null;
}

export function buildIntentDisambiguationTableHtmlFromText(message: unknown): string | null {
  const presentation = resolveRuntimeRichMessagePresentationFromText(message);
  if (!presentation || presentation.uiTypeId !== "choice.intent_disambiguation") return null;
  return presentation.html;
}
