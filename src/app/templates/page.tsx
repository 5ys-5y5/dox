'use client';

import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import TemplateEditWorkspace from '../../components/template/TemplateEditWorkspace';

export default function TemplatesPage() {
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get('templateId')?.trim() || '';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 md:px-8">
        <TemplateEditWorkspace
          initialTemplateId={templateIdFromQuery}
          templateListDisplay="inline"
          showGuaranteedExtractControls
        />
      </div>
    </main>
  );
}
