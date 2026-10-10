use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepoMapEntry { pub path: String, pub symbols: Vec<String>, pub lines: u64 }

const MAX_FILES: usize = 2_000;
const MAX_FILE_BYTES: u64 = 512 * 1024;
const DEFAULT_TOKEN_BUDGET: usize = 4_000;
const CHARS_PER_TOKEN: usize = 4;

static SKIP_DIRS: Lazy<Vec<&'static str>> = Lazy::new(|| vec![
    ".git", "node_modules", "target", "dist", "build", ".next", ".turbo",
    "venv", ".venv", "__pycache__", ".idea", ".vscode", "coverage",
]);

fn is_text_ext(p: &Path) -> bool {
    matches!(
        p.extension().and_then(|s| s.to_str()).map(|s| s.to_ascii_lowercase()).as_deref(),
        Some("rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "go" | "java" | "kt"
            | "c" | "h" | "cpp" | "hpp" | "cs" | "rb" | "php" | "swift"
            | "md" | "toml" | "json" | "yaml" | "yml" | "sql" | "sh")
    )
}

static RE_RS: Lazy<Regex> = Lazy::new(|| Regex::new(
    r"(?m)^\s*(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?(?:fn|struct|enum|trait|impl|mod|type|const|static)\s+([A-Za-z_][A-Za-z0-9_]*)"
).unwrap());
static RE_TS: Lazy<Regex> = Lazy::new(|| Regex::new(
    r"(?m)^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)"
).unwrap());
static RE_TS_METHOD: Lazy<Regex> = Lazy::new(|| Regex::new(
    r"(?m)^\s{2,}(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*[:{]"
).unwrap());
static RE_PY: Lazy<Regex> = Lazy::new(|| Regex::new(
    r"(?m)^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)"
).unwrap());
static RE_GO: Lazy<Regex> = Lazy::new(|| Regex::new(
    r"(?m)^\s*(?:func|type|var|const)\s+(?:\([^)]*\)\s*)?([A-Za-z_][A-Za-z0-9_]*)"
).unwrap());

fn extract_symbols(path: &Path, content: &str, cap: usize) -> Vec<String> {
    let ext = path.extension().and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase()).unwrap_or_default();
    let mut syms: Vec<String> = Vec::new();
    let mut push = |s: String| {
        if !s.is_empty() && !syms.contains(&s) && syms.len() < cap { syms.push(s); }
    };
    match ext.as_str() {
        "rs" => for c in RE_RS.captures_iter(content) { push(c[1].to_string()); },
        "ts" | "tsx" | "js" | "jsx" => {
            for c in RE_TS.captures_iter(content) { push(c[1].to_string()); }
            for c in RE_TS_METHOD.captures_iter(content) { push(c[1].to_string()); }
        }
        "py" => for c in RE_PY.captures_iter(content) { push(c[1].to_string()); },
        "go" => for c in RE_GO.captures_iter(content) { push(c[1].to_string()); },
        _ => {}
    }
    syms
}

#[tauri::command]
pub async fn build_repo_map(
    root: String, token_budget: Option<usize>,
) -> Result<Vec<RepoMapEntry>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() { return Err(format!("'{root}' không phải thư mục.")); }
    let budget_chars = token_budget.unwrap_or(DEFAULT_TOKEN_BUDGET) * CHARS_PER_TOKEN;

    let entries = tokio::task::spawn_blocking(move || -> Vec<RepoMapEntry> {
        let mut out: Vec<RepoMapEntry> = Vec::new();
        let mut total_chars = 0usize;
        for entry in WalkDir::new(&root_path).max_depth(12).follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !(e.file_type().is_dir() && SKIP_DIRS.iter().any(|s| *s == name))
            }).flatten()
        {
            if out.len() >= MAX_FILES || total_chars >= budget_chars { break; }
            let p = entry.path();
            if !entry.file_type().is_file() || !is_text_ext(p) { continue; }
            if entry.metadata().map(|m| m.len()).unwrap_or(0) > MAX_FILE_BYTES { continue; }
            let Ok(content) = std::fs::read_to_string(p) else { continue; };
            let lines = content.lines().count() as u64;
            let rel = p.strip_prefix(&root_path).unwrap_or(p)
                .to_string_lossy().replace('\\', "/");
            let symbols = extract_symbols(p, &content, 40);
            if symbols.is_empty() { continue; }
            let cost = rel.len() + symbols.iter().map(|s| s.len() + 2).sum::<usize>() + 8;
            if total_chars + cost > budget_chars && !out.is_empty() { break; }
            total_chars += cost;
            out.push(RepoMapEntry { path: rel, symbols, lines });
        }
        out
    }).await.map_err(|e| format!("repo-map task: {e}"))?;

    Ok(entries)
}
