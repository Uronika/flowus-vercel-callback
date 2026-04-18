export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return htmlResponse(`
      <h2>FlowUs 授权失败</h2>
      <p><strong>error:</strong> ${escapeHtml(error)}</p>
      <p><strong>description:</strong> ${escapeHtml(errorDescription || "未知错误")}</p>
    `, 400);
  }

  if (!code) {
    return htmlResponse(`
      <h2>缺少授权码</h2>
      <p>当前请求没有携带 code 参数，无法继续交换 access token。</p>
    `, 400);
  }

  const tokenUrl = process.env.FLOWUS_TOKEN_URL;
  const clientId = process.env.FLOWUS_CLIENT_ID;
  const clientSecret = process.env.FLOWUS_CLIENT_SECRET;
  const redirectUri = process.env.FLOWUS_REDIRECT_URI;

  if (!tokenUrl || !clientId || !clientSecret || !redirectUri) {
    return htmlResponse(`
      <h2>服务器配置不完整</h2>
      <p>请在 Vercel Environment Variables 中配置：</p>
      <ul>
        <li>FLOWUS_TOKEN_URL</li>
        <li>FLOWUS_CLIENT_ID</li>
        <li>FLOWUS_CLIENT_SECRET</li>
        <li>FLOWUS_REDIRECT_URI</li>
      </ul>
    `, 500);
  }

  // 这里按 OAuth 2.0 授权码流程，向 token endpoint 发起服务端换 token 请求
  // token endpoint 的精确 URL / 兼容字段，以 FlowUs 官方文档为准
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });

  let tokenResp;
  let tokenText = "";

  try {
    tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    tokenText = await tokenResp.text();
  } catch (err) {
    return htmlResponse(`
      <h2>请求 token endpoint 失败</h2>
      <pre>${escapeHtml(String(err))}</pre>
    `, 500);
  }

  let tokenJson = null;
  try {
    tokenJson = JSON.parse(tokenText);
  } catch {
    // 保留原始文本，下面展示
  }

  if (!tokenResp.ok) {
    return htmlResponse(`
      <h2>FlowUs token 交换失败</h2>
      <p><strong>HTTP 状态:</strong> ${tokenResp.status}</p>
      <p><strong>state:</strong> ${escapeHtml(state || "")}</p>
      <h3>返回内容</h3>
      <pre>${escapeHtml(tokenText)}</pre>
    `, 500);
  }

  // 现在先不把 token 明文展示到页面，避免泄漏
  // 先只做“成功到达并成功交换”的验证
  return htmlResponse(`
    <h2>FlowUs 授权成功</h2>
    <p>已收到授权码，并成功完成 token 交换。</p>
    <p><strong>state:</strong> ${escapeHtml(state || "")}</p>
    <p>你现在可以关闭这个页面，回到客户端继续后续流程。</p>
    <details>
      <summary>调试信息（谨慎展开）</summary>
      <pre>${escapeHtml(JSON.stringify(maskTokenPayload(tokenJson), null, 2))}</pre>
    </details>
  `, 200);
}

function htmlResponse(innerHtml, status = 200) {
  return new Response(
    `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>FlowUs OAuth Callback</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            max-width: 720px;
            margin: 40px auto;
            padding: 0 16px;
            line-height: 1.6;
          }
          h2 { margin-bottom: 12px; }
          pre {
            background: #f6f8fa;
            padding: 12px;
            border-radius: 8px;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
          }
          details { margin-top: 16px; }
        </style>
      </head>
      <body>${innerHtml}</body>
    </html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    }
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function maskTokenPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const cloned = { ...payload };

  for (const key of Object.keys(cloned)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("access") ||
      lower.includes("refresh")
    ) {
      cloned[key] = "***masked***";
    }
  }

  return cloned;
}