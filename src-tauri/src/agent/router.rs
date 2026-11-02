use super::TaskRequest;
pub fn route(request: &TaskRequest) -> &'static str {
    if request.mode == "chat"
        || request.goal.trim_start().starts_with(['/', '@'])
        || request.route.as_deref() == Some("reflex")
    {
        return "reflex";
    }
    if request.route.as_deref() == Some("dag") {
        return "dag";
    }
    let goal = request.goal.to_lowercase();
    let stages = [
        "sau đó",
        "tiếp theo",
        "đồng thời",
        "then ",
        "in parallel",
        "báo cáo",
        "kiểm thử",
        "research",
    ]
    .iter()
    .filter(|s| goal.contains(**s))
    .count();
    if stages >= 2 || (goal.chars().count() > 250 && stages > 0) {
        "dag"
    } else {
        "reflex"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn simple_requests_skip_planning() {
        let request = |goal: &str| TaskRequest {
            goal: goal.into(),
            mode: "computer_use".into(),
            route: None,
        };
        assert_eq!(route(&request("Chào bạn")), "reflex");
        assert_eq!(route(&request("/dondep")), "reflex");
        assert_eq!(
            route(&request("Tra cứu lỗi, sau đó sửa và kiểm thử rồi báo cáo")),
            "dag"
        );
    }
}
