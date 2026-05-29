const DOCUMENT_OWNER_WORKSPACE_PROFILE = 'owner-workspace';
const DOCUMENT_PICKER_LIST_PROFILE = 'picker';

export const buildOwnerWorkspaceDocumentDetailPath = (documentId: string) =>
  `/api/documents/${encodeURIComponent(documentId.trim())}?profile=${DOCUMENT_OWNER_WORKSPACE_PROFILE}`;

export const buildPickerDocumentListPath = ({ siteId }: { siteId?: string | null } = {}) => {
  const searchParams = new URLSearchParams();
  const normalizedSiteId = siteId?.trim() || '';

  if (normalizedSiteId) {
    searchParams.set('siteId', normalizedSiteId);
  }

  searchParams.set('latestOnly', 'true');
  searchParams.set('profile', DOCUMENT_PICKER_LIST_PROFILE);

  return `/api/documents?${searchParams.toString()}`;
};
