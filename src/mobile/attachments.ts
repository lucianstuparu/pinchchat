/**
 * Attachment encoding for the mobile composer.
 *
 * Upstream ChatInput accepts images only and recompresses them to ~225 KB on the
 * assumption of a 512 KB WebSocket frame limit. OpenClaw 2026.9 advertises
 * attachments.maxBytes ≈ 18.5 MiB and maxImageBytes 6 MiB in its connect
 * policy, so here any file type is sent, and images are only downscaled when
 * they actually exceed the image limit.
 */

export interface OutgoingAttachment {
  mimeType: string;
  fileName: string;
  /** Raw base64, no data: prefix */
  content: string;
  /** Decoded size in bytes, for display */
  size: number;
}

/** Conservative defaults matching OpenClaw 2026.9's advertised policy. */
export const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2560;

export class AttachmentTooLargeError extends Error {
  readonly fileName: string;
  readonly size: number;

  constructor(fileName: string, size: number) {
    super(`${fileName} is too large (${formatBytes(size)}; limit ${formatBytes(MAX_ATTACHMENT_BYTES)})`);
    this.fileName = fileName;
    this.size = size;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Downscale an image until it fits the gateway's image limit. */
async function shrinkImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.7, 0.55, 0.4]) {
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (out && out.size <= MAX_IMAGE_BYTES) return out;
  }
  throw new AttachmentTooLargeError('image', blob.size);
}

export async function encodeAttachment(blob: Blob, fileName: string): Promise<OutgoingAttachment> {
  const mimeType = blob.type || 'application/octet-stream';
  let payload = blob;
  let name = fileName;
  if (mimeType.startsWith('image/') && blob.size > MAX_IMAGE_BYTES) {
    payload = await shrinkImage(blob);
    name = fileName.replace(/\.[^.]+$/, '') + '.jpg';
  }
  if (payload.size > MAX_ATTACHMENT_BYTES) throw new AttachmentTooLargeError(fileName, payload.size);
  return {
    mimeType: payload.type || mimeType,
    fileName: name,
    content: await blobToBase64(payload),
    size: payload.size,
  };
}
