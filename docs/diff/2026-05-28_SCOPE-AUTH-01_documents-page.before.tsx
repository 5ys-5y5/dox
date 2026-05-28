import { DocumentsOwnerWorkspace, type DocumentsOwnerSurface } from './_owner';

type DocumentsPageSearchParams = Record<string, string | string[] | undefined>;

const readSearchParam = (searchParams: DocumentsPageSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = searchParams[key];
    const normalizedValue = Array.isArray(value) ? value[0] : value;

    if (normalizedValue?.trim()) {
      return normalizedValue.trim();
    }
  }

  return '';
};

const normalizeDocumentsOwnerSurface = (value: string): DocumentsOwnerSurface | undefined => {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'documents' || normalizedValue === '/documents') {
    return 'documents';
  }

  if (normalizedValue === 'project' || normalizedValue === '/project') {
    return 'project';
  }

  return undefined;
};

const readDocumentsOwnerSurfaceParam = (searchParams: DocumentsPageSearchParams) => {
  const surfaceKeys = [
    'ownerSurface',
    'documentsOwnerSurface',
    'settingsSurface',
    'surface',
    'ownerPage',
    'page',
  ];

  for (const key of surfaceKeys) {
    const surfaceValue = readSearchParam(searchParams, [key]);
    const normalizedSurface = surfaceValue ? normalizeDocumentsOwnerSurface(surfaceValue) : undefined;

    if (normalizedSurface) {
      return normalizedSurface;
    }
  }

  return undefined;
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<DocumentsPageSearchParams> | DocumentsPageSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {});
  const initialSiteId = readSearchParam(resolvedSearchParams, ['projectId', 'siteId', 'project']);
  const initialDocumentId = readSearchParam(resolvedSearchParams, ['documentId', 'document']);
  const outputSurface = readDocumentsOwnerSurfaceParam(resolvedSearchParams);

  return (
    <DocumentsOwnerWorkspace
      initialSiteId={initialSiteId}
      lockedDocumentId={initialDocumentId}
      outputSurface={outputSurface}
    />
  );
}
