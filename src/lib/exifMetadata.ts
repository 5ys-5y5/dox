import type { PhotoDetectedMetadataDto } from './photoLabelDtos';

const EMPTY_METADATA: PhotoDetectedMetadataDto = {
  capturedAt: null,
  capturedLocationText: null,
  capturedLatitude: null,
  capturedLongitude: null,
};

const isJpegFile = (file: File) =>
  file.type === 'image/jpeg' ||
  file.type === 'image/jpg' ||
  /\.(jpe?g)$/i.test(file.name);

const formatExifDateTime = (value: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, '$1-$2-$3T');

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    return null;
  }

  return normalized.slice(0, 16);
};

const formatLocationText = (latitude: number | null, longitude: number | null) => {
  if (latitude === null || longitude === null) {
    return null;
  }

  return `위도 ${latitude.toFixed(6)}, 경도 ${longitude.toFixed(6)}`;
};

const toSignedCoordinate = (values: number[] | null, ref: string | null) => {
  if (!values || values.length < 3) {
    return null;
  }

  const degrees = values[0] || 0;
  const minutes = values[1] || 0;
  const seconds = values[2] || 0;
  const absolute = degrees + minutes / 60 + seconds / 3600;

  if (ref === 'S' || ref === 'W') {
    return -absolute;
  }

  return absolute;
};

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8,
};

const readAscii = (view: DataView, start: number, count: number) => {
  const bytes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const nextByte = view.getUint8(start + index);
    if (nextByte === 0) {
      break;
    }
    bytes.push(nextByte);
  }

  return String.fromCharCode(...bytes).trim() || null;
};

const readRational = (view: DataView, start: number, littleEndian: boolean) => {
  const numerator = view.getUint32(start, littleEndian);
  const denominator = view.getUint32(start + 4, littleEndian);

  if (!denominator) {
    return 0;
  }

  return numerator / denominator;
};

const readEntryValue = (
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean
) => {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const unitSize = TYPE_SIZE[type];

  if (!unitSize || count === 0) {
    return null;
  }

  const valueByteLength = unitSize * count;
  const inlineValueOffset = entryOffset + 8;
  const dataOffset =
    valueByteLength <= 4 ? inlineValueOffset : tiffStart + view.getUint32(entryOffset + 8, littleEndian);

  switch (type) {
    case 2:
      return readAscii(view, dataOffset, count);
    case 3:
      if (count === 1) {
        return view.getUint16(dataOffset, littleEndian);
      }
      return Array.from({ length: count }, (_value, index) => view.getUint16(dataOffset + index * 2, littleEndian));
    case 4:
      if (count === 1) {
        return view.getUint32(dataOffset, littleEndian);
      }
      return Array.from({ length: count }, (_value, index) => view.getUint32(dataOffset + index * 4, littleEndian));
    case 5:
      if (count === 1) {
        return readRational(view, dataOffset, littleEndian);
      }
      return Array.from({ length: count }, (_value, index) => readRational(view, dataOffset + index * 8, littleEndian));
    default:
      return null;
  }
};

const parseIfd = (view: DataView, tiffStart: number, ifdOffset: number, littleEndian: boolean) => {
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  const values = new Map<number, unknown>();

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    const tag = view.getUint16(entryOffset, littleEndian);
    values.set(tag, readEntryValue(view, tiffStart, entryOffset, littleEndian));
  }

  return values;
};

const parseExifBuffer = (buffer: ArrayBuffer): PhotoDetectedMetadataDto => {
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return EMPTY_METADATA;
  }

  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if (marker === 0xffda || marker === 0xffd9) {
      break;
    }

    const segmentLength = view.getUint16(offset);
    const segmentStart = offset + 2;

    if (
      marker === 0xffe1 &&
      segmentStart + 6 <= view.byteLength &&
      readAscii(view, segmentStart, 4) === 'Exif'
    ) {
      const tiffStart = segmentStart + 6;

      if (tiffStart + 8 > view.byteLength) {
        return EMPTY_METADATA;
      }

      const endianMarker = String.fromCharCode(view.getUint8(tiffStart), view.getUint8(tiffStart + 1));
      const littleEndian = endianMarker === 'II';
      const rootIfdOffset = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
      const rootIfd = parseIfd(view, tiffStart, rootIfdOffset, littleEndian);

      const exifIfdPointer = rootIfd.get(0x8769);
      const gpsIfdPointer = rootIfd.get(0x8825);
      const exifIfd =
        typeof exifIfdPointer === 'number'
          ? parseIfd(view, tiffStart, tiffStart + exifIfdPointer, littleEndian)
          : null;
      const gpsIfd =
        typeof gpsIfdPointer === 'number'
          ? parseIfd(view, tiffStart, tiffStart + gpsIfdPointer, littleEndian)
          : null;

      const exifDateTime =
        (typeof exifIfd?.get(0x9003) === 'string' ? (exifIfd?.get(0x9003) as string) : null) ||
        (typeof rootIfd.get(0x0132) === 'string' ? (rootIfd.get(0x0132) as string) : null);

      const latitude = toSignedCoordinate(
        Array.isArray(gpsIfd?.get(0x0002)) ? (gpsIfd?.get(0x0002) as number[]) : null,
        typeof gpsIfd?.get(0x0001) === 'string' ? (gpsIfd?.get(0x0001) as string) : null
      );
      const longitude = toSignedCoordinate(
        Array.isArray(gpsIfd?.get(0x0004)) ? (gpsIfd?.get(0x0004) as number[]) : null,
        typeof gpsIfd?.get(0x0003) === 'string' ? (gpsIfd?.get(0x0003) as string) : null
      );

      return {
        capturedAt: formatExifDateTime(exifDateTime),
        capturedLocationText: formatLocationText(latitude, longitude),
        capturedLatitude: latitude,
        capturedLongitude: longitude,
      };
    }

    offset = segmentStart + segmentLength - 2;
  }

  return EMPTY_METADATA;
};

export const extractPhotoExifMetadata = async (file: File): Promise<PhotoDetectedMetadataDto> => {
  if (!isJpegFile(file)) {
    return EMPTY_METADATA;
  }

  try {
    const buffer = await file.arrayBuffer();
    return parseExifBuffer(buffer);
  } catch {
    return EMPTY_METADATA;
  }
};
