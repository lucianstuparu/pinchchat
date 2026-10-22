/**
 * Photos for the Shopping assistant: shrunk on the phone before upload (a 4 MB camera picture
 * becomes ~250 KB, enough to read a label or a receipt), so they fit the offline queue and send fast.
 */
const MAX_SIDE = 1800;

export async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return url.slice(url.indexOf(',') + 1);   // base64 without the data: prefix
}

/** Where the app shows a stored photo from (served by the desk API, behind Cloudflare Access). */
export const photoUrl = (ref: string) => `/shop/media/${ref}`;
