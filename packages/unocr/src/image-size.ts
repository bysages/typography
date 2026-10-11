/**
 * Minimal image dimension sniffing for PNG, JPEG, GIF, and WebP. OCR backends
 * report box coordinates in source-image pixels, and normalizing them needs
 * the full canvas size, which recognition results do not carry. Other formats
 * return null and callers fall back to content-bounds normalization.
 */
export function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;

  // PNG: 8-byte signature, then IHDR with big-endian width/height.
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return {
      width: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19],
      height: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23],
    };
  }

  // GIF: "GIF8?a", little-endian width/height at offset 6.
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return {
      width: bytes[6] | (bytes[7] << 8),
      height: bytes[8] | (bytes[9] << 8),
    };
  }

  // JPEG: scan segment markers for the first SOF0-SOF15 (except DHT/DAC/JPG).
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        };
      }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2) return null;
      offset += 2 + length;
    }
    return null;
  }

  // WebP: RIFF header, then VP8 (lossy), VP8L (lossless), or VP8X (extended).
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (fourcc === "VP8 ") {
      // VP8 lossy stores width-1/height-1 in 14 bits.
      return {
        width: ((bytes[26] | (bytes[27] << 8)) & 0x3fff) + 1,
        height: ((bytes[28] | (bytes[29] << 8)) & 0x3fff) + 1,
      };
    }
    if (fourcc === "VP8L") {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (fourcc === "VP8X") {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height };
    }
  }

  return null;
}
