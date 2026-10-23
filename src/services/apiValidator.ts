export async function validateApiKey(
  provider: "gemini" | "openai" | "claude" | "deepseek",
  key: string
): Promise<{ valid: boolean; error?: string }> {
  const cleanKey = key.trim();
  if (!cleanKey) return { valid: false, error: "Vui lòng nhập key." };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    let res: Response;
    if (provider === "gemini") {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
        { signal: controller.signal }
      );
    } else if (provider === "openai") {
      res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: controller.signal,
      });
    } else if (provider === "claude") {
      res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": cleanKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        signal: controller.signal,
      });
    } else if (provider === "deepseek") {
      res = await fetch("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${cleanKey}` },
        signal: controller.signal,
      });
    } else {
      return { valid: false, error: "Provider không hỗ trợ" };
    }

    if (res.status === 200) return { valid: true };
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { valid: false, error: "API Key không hợp lệ, sai định dạng hoặc đã hết hạn." };
    }
    if (res.status === 429) {
      return { valid: false, error: "Đã chạm ngưỡng giới hạn (Rate limit)." };
    }

    try {
      const errJson = await res.json();
      const msg = errJson?.error?.message || errJson?.message;
      if (msg) return { valid: false, error: msg };
    } catch {
      // ignore parse error
    }
    return { valid: false, error: `Lỗi máy chủ (${res.status}).` };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { valid: false, error: "Quá thời gian chờ phản hồi từ máy chủ (Timeout 10s)." };
    }
    return { valid: false, error: "Không kết nối được đến máy chủ API (Mất kết nối mạng)." };
  } finally {
    clearTimeout(timeoutId);
  }
}

