export async function validateApiKey(provider: "gemini" | "openai" | "claude", key: string) {
  const cleanKey = key.trim();
  if (!cleanKey) return { valid: false, error: "Vui lòng nhập key." };

  try {
    let res: Response;
    if (provider === "gemini") {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    } else if (provider === "openai") {
      res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${cleanKey}` } });
    } else if (provider === "claude") {
      res = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": cleanKey, "anthropic-version": "2023-06-01" } });
    } else return { valid: false, error: "Provider không hỗ trợ" };

    if (res.status === 200) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, error: "API Key không hợp lệ." };
    if (res.status === 429) return { valid: false, error: "Đã chạm ngưỡng giới hạn (Rate limit)." };
    return { valid: false, error: `Lỗi máy chủ (${res.status}).` };
  } catch (err) {
    return { valid: false, error: "Mất kết nối mạng." };
  }
}
