'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CanvasOwnedWorkspace } from '../../canvas/ownerPolicy';

export default function TemplateEditPage() {
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get('templateId')?.trim() || '';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-6 py-6">
        <CanvasOwnedWorkspace surface="templates-edit" initialTemplateId={templateIdFromQuery} templateListDisplay="inline" />
      </div>
    </main>
  );
}
