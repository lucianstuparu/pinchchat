import type { ChatMessage } from '../types';

/**
 * Convert a list of chat messages into a Markdown string suitable for export.
 */
export function messagesToMarkdown(messages: ChatMessage[], sessionLabel?: string): string {
  const lines: string[] = [];

  if (sessionLabel) {
    lines.push(`# ${sessionLabel}`, '');
  }

  const exportDate = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  lines.push(`> Exported from Chat on ${exportDate}`, '');

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const roleLabel = msg.role === 'user'
      ? (msg.isSystemEvent ? '⚙️ System Event' : '👤 User')
      : '🤖 Assistant';

    lines.push(`## ${roleLabel} — ${time}`, '');

    if (msg.blocks && msg.blocks.length > 0) {
      for (const block of msg.blocks) {
        switch (block.type) {
          case 'text':
            lines.push(block.text, '');
            break;
          case 'thinking':
            lines.push('<details><summary>💭 Thinking</summary>', '', block.text, '', '</details>', '');
            break;
          case 'tool_use':
            lines.push(`**🔧 Tool: \`${block.name}\`**`, '');
            if (block.input && Object.keys(block.input).length > 0) {
              lines.push('```json', JSON.stringify(block.input, null, 2), '```', '');
            }
            break;
          case 'tool_result':
            if (block.content) {
              const label = block.name ? `Result (${block.name})` : 'Result';
              lines.push(`<details><summary>📋 ${label}</summary>`, '');
              lines.push('```', block.content.slice(0, 5000), '```', '');
              lines.push('</details>', '');
            }
            break;
          case 'image':
            lines.push('*[Image]*', '');
            break;
        }
      }
    } else if (msg.content) {
      lines.push(msg.content, '');
    }

    lines.push('---', '');
  }

  return lines.join('\n');
}

/**
 * Trigger a browser file download with the given content.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
