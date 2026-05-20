export const resolvePreferredDocumentHtml = (params: {
  linkedRenderHtml?: string | null;
  latestVersionHtml?: string | null;
}) => {
  const linkedRenderHtml = params.linkedRenderHtml?.trim() || '';
  const latestVersionHtml = params.latestVersionHtml?.trim() || '';

  if (linkedRenderHtml) {
    return linkedRenderHtml;
  }

  return latestVersionHtml;
};

export const buildDocumentHtmlContentKey = (html: string) => {
  const normalizedHtml = String(html || '');
  let hash = 0;

  for (let index = 0; index < normalizedHtml.length; index += 1) {
    hash = (hash * 31 + normalizedHtml.charCodeAt(index)) | 0;
  }

  return `${normalizedHtml.length}:${(hash >>> 0).toString(36)}`;
};
