# 0526 click selection performance experiment

## Goal
- Match click selection response to the visual speed of drag selection.
- The target is not theory-based. Each candidate must be applied, measured in the browser, then restored before the next candidate is tested.

## Whitelist
- `src/lib/ownerDomNaming.ts`
- `src/app/canvas/page.tsx`
- `src/app/documents/_owner/DocumentsOwnerWorkspace.tsx`
- `src/components/template/TemplateEditWorkspace.tsx`
- `src/components/template/workspace/canvas/useCanvasPointerHandlers.ts`
- `docs/0526-click-selection-perf-experiment.md`
- `docs/backups/0526-click-selection-perf/**`

## Baseline Backup
- Backup directory: `docs/backups/0526-click-selection-perf/baseline`
- Restore rule: copy the matching backup file over the working file before testing the next candidate.

## Candidates
- Candidate A: click path uses the same fast visual path as drag, then commits details after the visual update.
- Candidate B: click path keeps current selection logic, but defers panel/callback/detail hydration after selection visuals.
- Candidate C: selection details are pre-indexed and click reads from the index while live DOM detail reads are deferred.

## Measurement Checklist
- Measure drag selection visual latency.
- Measure click selection visual latency.
- Measure click detail/value availability latency.
- Count `data-canvas-owner-*` writes during click.
- Count `querySelectorAll('*')` calls during click.
- Compare candidates against the same URL:
  `http://localhost:3001/canvas?page=canvas&mode=template&templateId=dc080119-76a5-4785-a698-4dca1e1609f1`

## Decision Rule
- Pick the smallest change that reaches the target latency.
- If two candidates are equal, choose the one with fewer touched lines and less cross-feature impact.

## Browser Measurements
URL: `http://localhost:3001/canvas?page=canvas&mode=template&templateId=dc080119-76a5-4785-a698-4dca1e1609f1`

| Case | Position click dispatch | Position first visual | Metadata click dispatch | Metadata first visual | Owner writes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 144.0ms | 5.2ms | 141.9ms | 6.3ms | 0 |
| Candidate A: visual first, defer detail computation and React state | 14.7ms | 8.5ms | 5.9ms | 2.8ms | 0 |
| Candidate B: defer only `flushSync` state commit with `setTimeout` | 11.5ms | 6.6ms | 9.1ms | 4.9ms | 0 |
| Candidate C: remove `flushSync`, keep React default batching | 12.0ms | 6.5ms | 6.6ms | 3.4ms | 0 |
| Final verification after reload | 7.7ms | 4.1ms | 7.1ms | 3.8ms | 0 |

## Selected Candidate
- Candidate C is selected.
- Reason: it reaches the target speed with the smallest code change.
- Impact scope: selection state commit timing only. Existing DOM selection visuals, metadata draft creation, and selected value reads remain in the same function order.
