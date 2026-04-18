export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const FLOWUS_API_BASE = process.env.FLOWUS_API_BASE || "https://api.flowus.cn";
  const TOKEN_URL = `${FLOWUS_API_BASE}/oauth/token`;

  const clientId = process.env.FLOWUS_CLIENT_ID;
  const clientSecret = process.env.FLOWUS_CLIENT_SECRET;
  const redirectUri = process.env.FLOWUS_REDIRECT_URI;

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
      <p>当前请求没有携带 <code>code</code> 参数。</p>
      <p>请从 FlowUs 授权入口重新发起授权。</p>
    `, 400);
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return htmlResponse(`
      <h2>服务器环境变量未配置完整</h2>
      <p>请在 Vercel 项目里补齐以下变量：</p>
      <ul>
        <li><code>FLOWUS_CLIENT_ID</code></li>
        <li><code>FLOWUS_CLIENT_SECRET</code></li>
        <li><code>FLOWUS_REDIRECT_URI</code></li>
      </ul>
    `, 500);
  }

  let tokenResponse;
  let tokenDataText = "";

  try {
    tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    });

    tokenDataText = await tokenResponse.text();
  } catch (err) {
    return htmlResponse(`
      <h2>请求 FlowUs Token 接口失败</h2>
      <pre>${escapeHtml(String(err))}</pre>
    `, 500);
  }

  let tokenData;
  try {
    tokenData = JSON.parse(tokenDataText);
  } catch {
    return htmlResponse(`
      <h2>Token 接口返回了非 JSON 内容</h2>
      <p><strong>HTTP 状态:</strong> ${tokenResponse.status}</p>
      <pre>${escapeHtml(tokenDataText)}</pre>
    `, 500);
  }

  if (!tokenResponse.ok) {
    return htmlResponse(`
      <h2>FlowUs Token 交换失败</h2>
      <p><strong>HTTP 状态:</strong> ${tokenResponse.status}</p>
      <p><strong>state:</strong> ${escapeHtml(state || "")}</p>
      <pre>${escapeHtml(JSON.stringify(tokenData, null, 2))}</pre>
    `, 500);
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  return htmlResponse(`
    <h2>FlowUs 授权成功</h2>
    <p>已收到 <code>code</code>，并成功交换访问令牌。</p>
    <p><strong>state:</strong> ${escapeHtml(state || "")}</p>
    <p>你现在可以关闭这个页面，回到你的客户端程序。</p>

    <details>
      <summary>调试信息</summary>
      <pre>${escapeHtml(JSON.stringify(maskSecrets({
        ...tokenData,
        access_token: accessToken,
        refresh_token: refreshToken
      }), null, 2))}</pre>
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
            max-width: 760px;
            margin: 40px auto;
            padding: 0 16px;
            line-height: 1.6;
          }
          code, pre {
            background: #f6f8fa;
            border-radius: 6px;
          }
          code {
            padding: 2px 6px;
          }
          pre {
            padding: 12px;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
          }
          details {
            margin-top: 16px;
          }
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

function maskSecrets(payload) {
  if (!payload || typeof payload !== "object") return payload;

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