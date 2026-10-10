use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs as tfs;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditBlock { pub path: String, pub search: String, pub replace: String }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub path: String, pub applied: bool, pub diff: String, pub error: Option<String>,
}

fn normalize(s: &str) -> String {
    s.replace("\r\n", "\n").replace('\r', "\n").trim_matches('\n').to_string()
}
fn normalize_lines(s: &str) -> Vec<String> {
    s.lines().map(|l| l.trim_end().to_string()).collect()
}

fn apply_edit(content: &str, search: &str, replace: &str) -> Result<String, String> {
    let search_n = normalize(search);
    let replace_n = normalize(replace);
    if search_n.is_empty() { return Ok(replace_n); }

    let occ = content.matches(&search_n).count();
    if occ == 1 { return Ok(content.replacen(&search_n, &replace_n, 1)); }
    if occ > 1 { return Err(format!("SEARCH khớp {occ} lần — cần thêm ngữ cảnh.")); }

    let hay_lines = normalize_lines(content);
    let needle = normalize_lines(&search_n);
    if needle.is_empty() { return Err("SEARCH rỗng.".into()); }

    let mut matches: Vec<usize> = Vec::new();
    'outer: for start in 0..=hay_lines.len().saturating_sub(needle.len()) {
        for (i, nl) in needle.iter().enumerate() {
            if hay_lines[start + i].trim_end() != nl.trim_end() { continue 'outer; }
        }
        matches.push(start);
    }
    match matches.len() {
        0 => Err("Không tìm thấy SEARCH block.".into()),
        1 => {
            let start = matches[0];
            let end = start + needle.len();
            let new_lines: Vec<String> = replace_n.split('\n').map(String::from).collect();
            let mut out: Vec<String> = Vec::with_capacity(hay_lines.len());
            out.extend_from_slice(&hay_lines[..start]);
            out.extend(new_lines);
            out.extend_from_slice(&hay_lines[end..]);
            Ok(out.join("\n"))
        }
        n => Err(format!("SEARCH khớp {n} lần (whitespace-tolerant).")),
    }
}

fn unified_diff(path: &str, old: &str, new: &str) -> String {
    let a: Vec<&str> = old.lines().collect();
    let b: Vec<&str> = new.lines().collect();
    let n = a.len(); let m = b.len();
    let mut lcs = vec![vec![0u32; m + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            lcs[i][j] = if a[i] == b[j] { lcs[i + 1][j + 1] + 1 }
                        else { lcs[i + 1][j].max(lcs[i][j + 1]) };
        }
    }
    let mut ops: Vec<(char, &str)> = Vec::new();
    let (mut i, mut j) = (0usize, 0usize);
    while i < n && j < m {
        if a[i] == b[j] { ops.push((' ', a[i])); i += 1; j += 1; }
        else if lcs[i + 1][j] >= lcs[i][j + 1] { ops.push(('-', a[i])); i += 1; }
        else { ops.push(('+', b[j])); j += 1; }
    }
    while i < n { ops.push(('-', a[i])); i += 1; }
    while j < m { ops.push(('+', b[j])); j += 1; }
    let mut out = String::new();
    out.push_str(&format!("--- a/{path}\n+++ b/{path}\n@@ -1,{n} +1,{m} @@\n"));
    for (tag, line) in ops { out.push(tag); out.push_str(line); out.push('\n'); }
    out
}

#[tauri::command]
pub async fn apply_edit_blocks(
    blocks: Vec<EditBlock>, dry_run: bool,
) -> Result<Vec<ApplyResult>, String> {
    let mut results: Vec<ApplyResult> = Vec::with_capacity(blocks.len());
    for block in blocks {
        let raw_path = PathBuf::from(&block.path);
        let display = block.path.clone();
        let original = match tfs::read_to_string(&raw_path).await {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
            Err(e) => {
                results.push(ApplyResult { path: display, applied: false,
                    diff: String::new(), error: Some(format!("read: {e}")) });
                continue;
            }
        };
        let new_content = match apply_edit(&original, &block.search, &block.replace) {
            Ok(s) => s,
            Err(err) => {
                results.push(ApplyResult { path: display, applied: false,
                    diff: String::new(), error: Some(err) });
                continue;
            }
        };
        let diff = unified_diff(&display, &original, &new_content);
        if !dry_run {
            if let Some(parent) = raw_path.parent() {
                if let Err(e) = tfs::create_dir_all(parent).await {
                    results.push(ApplyResult { path: display, applied: false, diff,
                        error: Some(format!("mkdir: {e}")) });
                    continue;
                }
            }
            if let Err(e) = tfs::write(&raw_path, new_content.as_bytes()).await {
                results.push(ApplyResult { path: display, applied: false, diff,
                    error: Some(format!("write: {e}")) });
                continue;
            }
        }
        results.push(ApplyResult { path: display, applied: true, diff, error: None });
    }
    Ok(results)
}
