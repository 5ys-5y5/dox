'use client';

import { TemplateExtractWorkspace } from '../../../components/template/TemplateExtractWorkspace';
import { CanvasOwnedWorkspace } from '../../canvas/ownerPolicy';

export default function TemplateExtractPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-6 py-6">
      <TemplateExtractWorkspace
        renderPreviewWorkspace={(draft) => (
          <CanvasOwnedWorkspace
            key={draft.draftKey}
            surface="templates-extract-preview"
            initialDraft={draft}
            hideHeader
            hidePersistencePanel
            suppressInitialDraftLoadedMessage
            templateNameReadOnly
            saveDisabled
          />
        )}
      />
    </main>
  );
}
