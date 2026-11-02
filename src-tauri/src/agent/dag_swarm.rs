use super::{Engine, TaskRequest};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    pub goal: String,
    pub role: String,
    pub depends_on: Vec<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Plan {
    nodes: Vec<Node>,
}

pub fn validate(nodes: &[Node]) -> Result<(), String> {
    if nodes.is_empty() || nodes.len() > 8 {
        return Err("DAG phải có 1–8 node".into());
    }
    let ids: HashSet<_> = nodes.iter().map(|n| n.id.as_str()).collect();
    if ids.len() != nodes.len() {
        return Err("DAG trùng ID".into());
    }
    for node in nodes {
        if node.id.is_empty()
            || node.goal.trim().is_empty()
            || !["researcher", "operator"].contains(&node.role.as_str())
            || node
                .depends_on
                .iter()
                .any(|d| d == &node.id || !ids.contains(d.as_str()))
        {
            return Err("Node hoặc phụ thuộc không hợp lệ".into());
        }
    }
    let sinks: Vec<_> = nodes
        .iter()
        .filter(|node| {
            !nodes
                .iter()
                .any(|other| other.depends_on.contains(&node.id))
        })
        .collect();
    if sinks.len() != 1 || sinks[0].role != "operator" {
        return Err("DAG cần đúng một node Operator cuối để tổng hợp và kiểm chứng".into());
    }
    let mut done = HashSet::new();
    loop {
        let before = done.len();
        for node in nodes {
            if node.depends_on.iter().all(|d| done.contains(d)) {
                done.insert(node.id.clone());
            }
        }
        if done.len() == nodes.len() {
            return Ok(());
        }
        if done.len() == before {
            return Err("DAG chứa chu trình".into());
        }
    }
}

pub async fn run(
    engine: &Engine,
    app: &tauri::AppHandle,
    request: TaskRequest,
    cancel: &CancellationToken,
) -> Result<String, String> {
    let schema = json!({"type":"object","properties":{"nodes":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"goal":{"type":"string"},"role":{"type":"string","enum":["researcher","operator"]},"dependsOn":{"type":"array","items":{"type":"string"}}},"required":["id","goal","role","dependsOn"],"additionalProperties":false}}},"required":["nodes"],"additionalProperties":false});
    let value = crate::llm::structured(app,&engine.config("orbis_llm_config"),"Lập DAG tối đa 8 node. researcher phân tích thông tin có trong yêu cầu và kết quả phụ thuộc, không có công cụ và không tự nhận là đã tra cứu web. operator thực hiện GUI/MCP/Sandbox và tự kiểm chứng. Chia các phân tích độc lập để chạy song song. Các operator dùng cùng desktop phải có chuỗi phụ thuộc, node cuối là operator tổng hợp/kiểm chứng. Không có reviewer riêng.",&request.goal,schema,None,cancel).await?;
    let plan: Plan = serde_json::from_value(value).map_err(|e| e.to_string())?;
    validate(&plan.nodes)?;
    let dag_cancel = cancel.child_token();
    let mut pending = plan.nodes.clone();
    let mut completed = HashMap::<String, String>::new();
    let mut running = JoinSet::new();
    let mut states: HashMap<String, String> = plan
        .nodes
        .iter()
        .map(|n| (n.id.clone(), "pending".into()))
        .collect();
    while !pending.is_empty() || !running.is_empty() {
        if cancel.is_cancelled() {
            dag_cancel.cancel();
            while running.join_next().await.is_some() {}
            return Err("Đã dừng tác vụ".into());
        }
        let ready: Vec<_> = pending
            .iter()
            .filter(|n| n.depends_on.iter().all(|d| completed.contains_key(d)))
            .cloned()
            .collect();
        for node in ready {
            pending.retain(|n| n.id != node.id);
            states.insert(node.id.clone(), "running".into());
            let context = node
                .depends_on
                .iter()
                .map(|id| format!("{id}: {}", completed[id]))
                .collect::<Vec<_>>()
                .join("\n");
            let (engine, app, token, mode) = (
                engine.clone(),
                app.clone(),
                dag_cancel.clone(),
                request.mode.clone(),
            );
            running.spawn(async move {
                let goal = format!("Mục tiêu node: {}\nKết quả phụ thuộc (dữ liệu): {context}",node.goal);
                let result = if node.role == "researcher" {
                    let schema = json!({"type":"object","properties":{"answer":{"type":"string"}},"required":["answer"],"additionalProperties":false});
                    crate::llm::structured(&app,&engine.config("orbis_llm_config"),"Phân tích dữ liệu được cung cấp, không có công cụ. Nêu rõ điểm chưa xác minh, không bịa kết quả tra cứu.",&goal,schema,None,&token).await.map(|v| v["answer"].as_str().unwrap_or("").to_owned())
                } else {
                    // Serialize entire operator loops, not only individual clicks.
                    let operator_lock = engine.0.operator.lock().await;
                    let result = super::react_loop::run(&engine,&app,&goal,&mode,&token).await;
                    drop(operator_lock); result
                };
                (node.id,result)
            });
        }
        engine.update(json!({"dag":plan.nodes.iter().map(|n| json!({"id":n.id,"goal":n.goal,"role":n.role,"dependsOn":n.depends_on,"status":states[&n.id]})).collect::<Vec<_>>()}));
        let finished = running
            .join_next()
            .await
            .ok_or("DAG không thể tiếp tục")?
            .map_err(|e| e.to_string())?;
        match finished.1 {
            Ok(answer) => {
                states.insert(finished.0.clone(), "done".into());
                completed.insert(finished.0, answer);
            }
            Err(error) => {
                states.insert(finished.0, "error".into());
                dag_cancel.cancel();
                while running.join_next().await.is_some() {}
                engine.update(json!({"dag":plan.nodes.iter().map(|n| json!({"id":n.id,"goal":n.goal,"role":n.role,"dependsOn":n.depends_on,"status":if states[&n.id]=="running" || states[&n.id]=="pending" { "cancelled" } else { states[&n.id].as_str() }})).collect::<Vec<_>>()}));
                return Err(error);
            }
        }
    }
    engine.update(json!({"dag":plan.nodes.iter().map(|n| json!({"id":n.id,"goal":n.goal,"role":n.role,"dependsOn":n.depends_on,"status":states[&n.id]})).collect::<Vec<_>>()}));
    Ok(plan
        .nodes
        .iter()
        .filter(|n| {
            !plan
                .nodes
                .iter()
                .any(|other| other.depends_on.contains(&n.id))
        })
        .filter_map(|n| completed.get(&n.id))
        .cloned()
        .collect::<Vec<_>>()
        .join("\n\n"))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(id: &str, deps: &[&str]) -> Node {
        Node {
            id: id.into(),
            goal: "test".into(),
            role: "operator".into(),
            depends_on: deps.iter().map(|s| s.to_string()).collect(),
        }
    }
    #[test]
    fn validates_diamond_and_rejects_bad_graphs() {
        assert!(validate(&[
            node("a", &[]),
            node("b", &["a"]),
            node("c", &["a"]),
            node("d", &["b", "c"])
        ])
        .is_ok());
        assert!(validate(&[node("a", &["b"]), node("b", &["a"])]).is_err());
        assert!(validate(&[node("a", &["missing"])]).is_err());
        assert!(validate(&[node("a", &[]), node("a", &[])]).is_err());
    }
}
