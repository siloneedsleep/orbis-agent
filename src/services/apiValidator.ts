export async function validateApiKey(provider: "gemini" | "openai" | "claude" | "deepseek", key: string) {
  const cleanKey = key.trim();
  if (!cleanKey) return { valid: false, error: "Vui lòng nhập key." };

  try {
    let res: Response;
    if (provider === "gemini") {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    } else if (provider === "openai") {
      res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${cleanKey}` } });
    } else if (provider === "claude") {
      res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": cleanKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        }
      });
    } else if (provider === "deepseek") {
      res = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${cleanKey}` } });
    } else return { valid: false, error: "Provider không hỗ trợ" };

    if (res.status === 200) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, error: "API Key không hợp lệ hoặc đã hết hạn." };
    if (res.status === 429) return { valid: false, error: "Đã chạm ngưỡng giới hạn (Rate limit)." };
    
    try {
      const errJson = await res.json();
      const msg = errJson?.error?.message || errJson?.message;
      if (msg) return { valid: false, error: msg };
    } catch {
      // ignore
    }
    return { valid: false, error: `Lỗi máy chủ (${res.status}).` };
  } catch (err) {
    return { valid: false, error: "Không kết nối được đến máy chủ API." };
  }
}
