import type { EditBlockPayload } from "@/ipc/commands";

const SEARCH_RE = /^<{5,9}\s*SEARCH\s*$/i;
const DIVIDER_RE = /^={5,9}\s*$/;
const REPLACE_RE = /^>{5,9}\s*REPLACE\s*$/i;

export function parseEditBlocks(text: string): EditBlockPayload[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: EditBlockPayload[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!SEARCH_RE.test(lines[i].trim())) { i++; continue; }

    let path = "";
    for (let k = i - 1; k >= 0; k--) {
      const prev = lines[k].trim();
      if (!prev || prev.startsWith("```")) continue;
      path = prev.replace(/^#+\s*/, "").replace(/^file[:\s]+/i, "").trim();
      break;
    }
    const searchLines: string[] = [];
    i++;
    while (i < lines.length && !DIVIDER_RE.test(lines[i].trim())) {
      searchLines.push(lines[i]); i++;
    }
    if (i >= lines.length) break;
    i++;
    const replaceLines: string[] = [];
    while (i < lines.length && !REPLACE_RE.test(lines[i].trim())) {
      replaceLines.push(lines[i]); i++;
    }
    if (i >= lines.length) break;
    i++;
    blocks.push({ path, search: searchLines.join("\n"), replace: replaceLines.join("\n") });
  }
  return blocks;
}

export function serializeEditBlock(b: EditBlockPayload): string {
  return [
    b.path, "<<<<<<< SEARCH", b.search.trimEnd(),
    "=======", b.replace.trimEnd(), ">>>>>>> REPLACE",
  ].join("\n");
}

export const EDIT_BLOCK_FORMAT_INSTRUCTION = `
Để sửa file, CHỈ trả về block:

\`\`\`
đường/dẫn/file.ext
<<<<<<< SEARCH
<đoạn code cũ, nguyên bản, đủ ngữ cảnh match DUY NHẤT>
=======
<đoạn code mới>
>>>>>>> REPLACE
\`\`\`

QUY TẮC:
- SEARCH phải match DUY NHẤT. Nếu trùng, thêm ngữ cảnh.
- SEARCH rỗng = tạo file mới với nội dung REPLACE.
- Không sinh lại toàn bộ file.
`.trim();
