export type PhotoRecordDto = {
  id: string;
  siteId: string;
  photoUrl: string | null;
  storagePath: string | null;
  photoTitle: string | null;
  description: string | null;
  capturedAt: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type PhotoCreateInput = {
  siteId: string;
  photoUrl?: string | null;
  storagePath?: string | null;
  photoTitle?: string | null;
  description?: string | null;
  capturedAt?: string | null;
};

export type PhotoCreateResult = {
  photo: PhotoRecordDto;
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
