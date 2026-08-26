export function splitTelegramMarkdown(text: string, limit = 3900): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  const blocks = text.split(/(```[\s\S]*?```)/g).filter(Boolean);
  let current = "";
  for (const block of blocks) {
    if (block.length > limit) {
      if (current) {
        parts.push(current.trim());
        current = "";
      }
      parts.push(...splitLongBlock(block, limit));
      continue;
    }
    if ((current + block).length > limit) {
      parts.push(current.trim());
      current = block;
    } else {
      current += block;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitLongBlock(block: string, limit: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < block.length; i += limit) {
    chunks.push(block.slice(i, i + limit));
  }
  return chunks;
}
