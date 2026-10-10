import { commands, type RepoMapEntry } from "@/ipc/commands";

export interface RepoMapOptions { tokenBudget?: number; }

export async function loadRepoMap(
  root: string, opts: RepoMapOptions = {},
): Promise<RepoMapEntry[]> {
  return commands.buildRepoMap(root, opts.tokenBudget);
}

export function renderRepoMap(entries: RepoMapEntry[], maxChars = 12_000): string {
  const lines: string[] = [];
  let total = 0;
  for (const e of entries) {
    const line = `${e.path}: ${e.symbols.join(", ")}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length + 1;
  }
  return lines.join("\n");
}
