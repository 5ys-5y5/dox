'use client';

import * as React from 'react';

type TemplateEditWorkspaceHeaderProps = {
  title: string;
  description: string;
};

export const TemplateEditWorkspaceHeader = ({
  title,
  description,
}: TemplateEditWorkspaceHeaderProps) => {
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle && !normalizedDescription) {
    return null;
  }

  return (
    <div className="space-y-1">
      {normalizedTitle ? <h1 className="text-2xl font-semibold text-slate-950">{normalizedTitle}</h1> : null}
      {normalizedDescription ? <p className="text-sm text-slate-600">{normalizedDescription}</p> : null}
    </div>
  );
};
