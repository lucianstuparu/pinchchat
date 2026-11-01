/**
 * Copy text to clipboard with fallback for insecure contexts.
 * navigator.clipboard requires HTTPS or localhost; falls back to
 * a temporary textarea + execCommand('copy') for HTTP deployments.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try the modern API first (requires secure context)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method
    }
  }

  // Fallback: temporary textarea + execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Move off-screen to avoid visual flash
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** The files in a paste (a screenshot copied on the phone or the laptop); empty for plain text. */
export function pastedFiles(e: { clipboardData: DataTransfer | null }): File[] {
  const items = Array.from(e.clipboardData?.items ?? []);
  return items.filter(i => i.kind === 'file').map(i => i.getAsFile()).filter((f): f is File => !!f);
}

/** Whether the app can read an image from the clipboard itself (a Paste button, not the keyboard). */
export const canReadClipboard = () => typeof navigator !== 'undefined' && !!navigator.clipboard?.read;

/** The images on the clipboard, read on a tap; Chrome asks once for permission. */
export async function clipboardImages(): Promise<File[]> {
  const out: File[] = [];
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find(t => t.startsWith('image/'));
    if (type) out.push(new File([await item.getType(type)], `screenshot.${type.split('/')[1] || 'png'}`, { type }));
  }
  return out;
}
