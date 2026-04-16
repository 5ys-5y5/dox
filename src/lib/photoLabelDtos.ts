export type PhotoRecordDto = {
  id: string;
  siteId: string;
  photoUrl: string | null;
  storagePath: string | null;
  storageBucket: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  photoTitle: string | null;
  description: string | null;
  capturedAt: string | null;
  capturedLocationText: string | null;
  capturedLatitude: number | null;
  capturedLongitude: number | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type PhotoCreateInput = {
  siteId: string;
  photoUrl?: string | null;
  storagePath?: string | null;
  storageBucket?: string | null;
  originalFileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  photoTitle?: string | null;
  description?: string | null;
  capturedAt?: string | null;
  capturedLocationText?: string | null;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
};

export type PhotoCreateResult = {
  photo: PhotoRecordDto;
};

export type PhotoUploadInput = {
  siteId: string;
  originalFileName: string;
  mimeType: string;
  fileBytes: Uint8Array;
  fileSizeBytes: number;
  photoTitle?: string | null;
  description?: string | null;
  capturedAt?: string | null;
  capturedLocationText?: string | null;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
};

export type PhotoUploadResult = {
  photo: PhotoRecordDto;
};

export type PhotoDetectedMetadataDto = {
  capturedAt: string | null;
  capturedLocationText: string | null;
  capturedLatitude: number | null;
  capturedLongitude: number | null;
};

export type PhotoManualLabelInput = {
  labelKey: string;
  note?: string | null;
};

export type PhotoSuggestedLabelInput = {
  labelKey: string;
  confidenceScore?: number | null;
  suggestionReason?: string | null;
  suggestionStatus?: 'review_needed' | 'accepted' | 'rejected';
};

export type PhotoManualLabelDto = {
  id: string;
  photoId: string;
  labelKey: string;
  note: string | null;
  createdAt: string;
};

export type PhotoSuggestedLabelDto = {
  id: string;
  photoId: string;
  labelKey: string;
  confidenceScore: number;
  suggestionReason: string | null;
  suggestionStatus: 'review_needed' | 'accepted' | 'rejected';
  createdAt: string;
};

export type PhotoLabelsSaveInput = {
  photoId: string;
  manualLabels?: PhotoManualLabelInput[];
  suggestedLabels?: PhotoSuggestedLabelInput[];
};

export type PhotoLabelsSaveResult = {
  photoId: string;
  manualLabelCount: number;
  suggestedLabelCount: number;
};

export type PhotoListItemDto = {
  photo: PhotoRecordDto;
  manualLabels: PhotoManualLabelDto[];
  suggestedLabels: PhotoSuggestedLabelDto[];
};

export type PhotoLabelRequirementInput = {
  labelKey: string;
  labelName: string;
  description?: string | null;
  documentTypeKey?: string | null;
  minimumPhotoCount?: number | null;
};

export type PhotoLabelRequirementsSaveInput = {
  siteId: string;
  requirements?: PhotoLabelRequirementInput[];
};

export type PhotoLabelRequirementDto = {
  id: string;
  siteId: string;
  labelKey: string;
  labelName: string;
  description: string | null;
  documentTypeKey: string | null;
  minimumPhotoCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PhotoLabelRequirementsSaveResult = {
  siteId: string;
  requirementCount: number;
  requirements: PhotoLabelRequirementDto[];
};

export type SitePhotoLabelGapStatus = 'covered' | 'review_needed' | 'missing';

export type SitePhotoLabelGapItemDto = {
  requirementId: string;
  siteId: string;
  labelKey: string;
  labelName: string;
  description: string | null;
  documentTypeKey: string | null;
  minimumPhotoCount: number;
  matchedPhotoCount: number;
  reviewPendingCount: number;
  missingPhotoCount: number;
  matchedPhotoIds: string[];
  reviewPendingPhotoIds: string[];
  coverageStatus: SitePhotoLabelGapStatus;
  createdAt: string;
  updatedAt: string;
};

export type SitePhotoLabelGapSummaryDto = {
  siteId: string;
  requirementCount: number;
  coveredCount: number;
  reviewNeededCount: number;
  missingCount: number;
  requirements: SitePhotoLabelGapItemDto[];
};
