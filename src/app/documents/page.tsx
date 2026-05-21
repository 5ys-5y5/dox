import { DocumentsOwnerWorkspace } from './_owner';

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

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<DocumentsPageSearchParams> | DocumentsPageSearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {});
  const initialSiteId = readSearchParam(resolvedSearchParams, ['projectId', 'siteId', 'project']);
  const initialDocumentId = readSearchParam(resolvedSearchParams, ['documentId', 'document']);

  return <DocumentsOwnerWorkspace initialSiteId={initialSiteId} lockedDocumentId={initialDocumentId} />;
}
