'use client';

import * as React from 'react';

type TemplateEditWorkspaceHeaderProps = {
  title: string;
  description: string;
  env?: string;
};

export const TemplateEditWorkspaceHeader = ({
  title,
  description,
  env = '',
}: TemplateEditWorkspaceHeaderProps) => {
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle && !normalizedDescription) {
    return null;
  }

  const envAttributes = { env };

  return (
    <div className="space-y-1" {...envAttributes}>
      {normalizedTitle ? <h1 className="text-2xl font-semibold text-slate-950">{normalizedTitle}</h1> : null}
      {normalizedDescription ? <p className="text-sm text-slate-600">{normalizedDescription}</p> : null}
    </div>
  );
};
