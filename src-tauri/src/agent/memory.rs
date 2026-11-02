use serde_json::{json, Value};
use std::{fs, io::Write, path::PathBuf, sync::mpsc};

type WriteMessage = (Value, Option<mpsc::SyncSender<Result<(), String>>>);
pub struct Memory {
    pub initial: Value,
    sender: mpsc::Sender<WriteMessage>,
}

impl Memory {
    pub fn open(path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let initial = if path.exists() {
            serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?)
                .map_err(|e| format!("Không đọc được bộ nhớ Orbis: {e}"))?
        } else {
            json!({"settings": {}, "workstream": []})
        };
        let (sender, receiver) = mpsc::channel::<WriteMessage>();
        std::thread::spawn(move || {
            while let Ok((mut next, acknowledgement)) = receiver.recv() {
                let mut acknowledgements = acknowledgement.into_iter().collect::<Vec<_>>();
                while let Ok((latest, acknowledgement)) = receiver.try_recv() {
                    next = latest;
                    acknowledgements.extend(acknowledgement);
                }
                let result = (|| -> std::io::Result<()> {
                    let mut tmp = tempfile::NamedTempFile::new_in(path.parent().unwrap())?;
                    serde_json::to_writer(&mut tmp, &next)?;
                    tmp.flush()?;
                    tmp.as_file().sync_all()?;
                    tmp.persist(&path).map_err(|e| e.error)?;
                    Ok(())
                })();
                let result = result.map_err(|e| format!("Không lưu được bộ nhớ: {e}"));
                if let Err(error) = &result {
                    eprintln!("[orbis] {error}");
                }
                for acknowledgement in acknowledgements {
                    let _ = acknowledgement.send(result.clone());
                }
            }
        });
        Ok(Self { initial, sender })
    }
    pub fn save(&self, state: &Value) {
        let _ = self.sender.send((
            json!({"settings": state["settings"], "workstream": state["workstream"]}),
            None,
        ));
    }
    pub async fn flush(&self, state: Value) -> Result<(), String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        self.sender
            .send((
                json!({"settings":state["settings"],"workstream":state["workstream"]}),
                Some(sender),
            ))
            .map_err(|e| e.to_string())?;
        tokio::task::spawn_blocking(move || receiver.recv().map_err(|e| e.to_string())?)
            .await
            .map_err(|e| e.to_string())?
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn settings_and_history_survive_atomic_replacement() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("memory.json");
        let memory = Memory::open(path.clone()).unwrap();
        memory
            .flush(json!({"settings":{"orbis_name":"Mèo"},"workstream":[{"content":"first"}]}))
            .await
            .unwrap();
        memory
            .flush(json!({"settings":{"orbis_name":"Orbis"},"workstream":[{"content":"second"}]}))
            .await
            .unwrap();
        let restored = Memory::open(path).unwrap();
        assert_eq!(restored.initial["settings"]["orbis_name"], "Orbis");
        assert_eq!(restored.initial["workstream"][0]["content"], "second");
    }
}
