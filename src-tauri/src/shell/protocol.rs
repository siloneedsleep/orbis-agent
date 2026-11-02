use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
};
use tauri::{
    http::{Request, Response, StatusCode},
    Manager,
};

pub fn respond(app: &tauri::AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    serve(app, &request).unwrap_or_else(|(status, message)| {
        Response::builder()
            .status(status)
            .header("Access-Control-Allow-Origin", "*")
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(message.into_bytes())
            .unwrap()
    })
}

fn serve(
    app: &tauri::AppHandle,
    req: &Request<Vec<u8>>,
) -> Result<Response<Vec<u8>>, (StatusCode, String)> {
    let error = |message: &str| (StatusCode::NOT_FOUND, message.to_owned());
    if req.method() != "GET" && req.method() != "HEAD" {
        return Err((
            StatusCode::METHOD_NOT_ALLOWED,
            "GET or HEAD required".into(),
        ));
    }
    let path = req.uri().path();
    let (bytes, mime, range, total) = if let Some(id) = path.strip_prefix("/frame/") {
        let cache = app.state::<crate::os::capture::FrameCache>();
        let frame = cache.get(id).ok_or_else(|| error("Frame expired"))?;
        let total = frame.len() as u64;
        // HTTP response owns its bytes. This final copy stays outside JSON IPC.
        (frame.as_ref().clone(), "image/jpeg", None, total)
    } else if let Some(clip) = path.strip_prefix("/pet/") {
        let path = crate::os::pet::resolve_clip(clip).map_err(|e| error(&e))?;
        let mut file = File::open(path).map_err(|e| error(&e.to_string()))?;
        let total = file.metadata().map_err(|e| error(&e.to_string()))?.len();
        let range = req.headers().get("Range").map(|v| v.to_str().unwrap_or(""));
        let selected = match range {
            Some(v) => {
                let (start, end) = parse_range(v, total)
                    .ok_or_else(|| (StatusCode::RANGE_NOT_SATISFIABLE, "Invalid range".into()))?;
                Some((start, end.min(start.saturating_add(1024 * 1024 - 1))))
            }
            None => None,
        };
        let (start, end) = selected.unwrap_or((0, total.saturating_sub(1)));
        file.seek(SeekFrom::Start(start))
            .map_err(|e| error(&e.to_string()))?;
        let mut bytes = Vec::new();
        if req.method() != "HEAD" && total > 0 {
            file.take(end - start + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| error(&e.to_string()))?;
        }
        (bytes, "video/webm", selected, total)
    } else {
        return Err(error("Unknown resource"));
    };
    let mut builder = Response::builder()
        .header("Content-Type", mime)
        .header("Access-Control-Allow-Origin", "*")
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "no-store");
    let len = if let Some((start, end)) = range {
        builder = builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header("Content-Range", format!("bytes {start}-{end}/{total}"));
        end - start + 1
    } else {
        total
    };
    builder
        .header("Content-Length", len)
        .body(if req.method() == "HEAD" {
            vec![]
        } else {
            bytes
        })
        .map_err(|e| error(&e.to_string()))
}

pub fn parse_range(value: &str, total: u64) -> Option<(u64, u64)> {
    if total == 0 {
        return None;
    }
    let (start, end) = value.strip_prefix("bytes=")?.split_once('-')?;
    if start.is_empty() {
        let suffix = end.parse::<u64>().ok()?;
        return (suffix > 0).then_some((total.saturating_sub(suffix), total - 1));
    }
    let start = start.parse::<u64>().ok()?;
    let end = if end.is_empty() {
        total - 1
    } else {
        end.parse::<u64>().ok()?.min(total - 1)
    };
    (start <= end && start < total).then_some((start, end))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn byte_ranges() {
        assert_eq!(parse_range("bytes=0-9", 100), Some((0, 9)));
        assert_eq!(parse_range("bytes=95-", 100), Some((95, 99)));
        assert_eq!(parse_range("bytes=-10", 100), Some((90, 99)));
        for bad in ["bytes=100-", "bytes=8-4", "bytes=0-1,4-5", "bytes=-0"] {
            assert!(parse_range(bad, 100).is_none());
        }
    }
}
