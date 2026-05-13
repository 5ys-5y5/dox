// Checklist: STYLE-SCOPE-MIXED-DISABLED-01
// Pre-change snippets for rollback

const resolveInlineStyleFieldStateClass = (field: StyleFieldKey) => {
  const applyStatus = styleFieldApplyStatus[field];

  if (applyStatus === 'saved') {
    return 'border-emerald-400 bg-emerald-50 text-slate-900 hover:bg-emerald-100';
  }

  if (applyStatus === 'failed') {
    return 'border-red-400 bg-red-50 text-red-950 hover:bg-red-100';
  }

  if (applyStatus === 'saving') {
    return 'border-sky-300 bg-sky-50 text-slate-900 hover:bg-sky-100';
  }

  return 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
};

const renderInlineNumericInput = (
  field: StyleFieldKey,
  ariaLabel: string,
  widthClassName = 'w-32',
  shortLabel = ariaLabel
) => {
  const inputStateClass = resolveInlineStyleFieldStateClass(field);
  const displayValue = hasAppearanceSelection ? selectionStyleDraft[field] : '';

  return (
    <Input
      data-style-field={field}
      value={displayValue}
      inputMode="decimal"
      aria-label={ariaLabel}
      title={ariaLabel}
      placeholder=""
      className={`h-8 w-full rounded-md border pl-[20px] pr-[16px] text-center text-[11px] font-semibold sm:pl-[50px] sm:pr-5 ${inputStateClass}`}
      onFocus={() => {
        hintAppearanceModeForStyleField(field);
      }}
      onChange={(event) => {
        hintAppearanceModeForStyleField(field, event.target.value);
        setStyleFieldDraftValue(field, event.target.value);
      }}
      onBlur={() => {
        applyStyleFieldOnBlur(field);
        const nextTarget = APPEARANCE_TARGET_BY_STYLE_FIELD[field];
        if (nextTarget === 'border' || nextTarget === 'corner') {
          clearAppearanceTargetModeIfNoSelection(nextTarget);
        }
      }}
    />
  );
};

const renderInlineBorderAlignPicker = () => {
  const currentBorderAlignValue = hasAppearanceSelection ? selectionStyleDraft.borderAlign : '';
  const currentLabel = currentBorderAlignValue
    ? FRAME_BORDER_ALIGN_LABEL_BY_VALUE.get(currentBorderAlignValue) || currentBorderAlignValue
    : '외곽선 정렬';
};

const renderInlineBorderStylePicker = () => (
  <>
    <input data-style-field="borderStyle" type="hidden" value={hasAppearanceSelection ? selectionStyleDraft.borderStyle : ''} readOnly />
    <button
      type="button"
      className={`inline-flex h-8 w-full items-center justify-center gap-0.5 rounded-md border px-1 text-[11px] font-semibold sm:gap-1 sm:px-1.5 ${resolveInlineStyleFieldStateClass('borderStyle')}`}
    >
      <span className="hidden sm:inline">
        {hasAppearanceSelection && selectionStyleDraft.borderStyle
          ? FRAME_BORDER_STYLE_LABEL_BY_VALUE.get(selectionStyleDraft.borderStyle) || selectionStyleDraft.borderStyle
          : '외곽선 타입'}
      </span>
      {hasAppearanceSelection && selectionStyleDraft.borderStyle
        ? renderBorderStylePreview(selectionStyleDraft.borderStyle, 'hidden sm:block w-10')
        : null}
    </button>
  </>
);
