export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const flowusApiBase = process.env.FLOWUS_API_BASE || "https://api.flowus.cn";
  const tokenUrl = `${stripTrailingSlash(flowusApiBase)}/oauth/token`;

  const clientId = process.env.FLOWUS_CLIENT_ID;
  const clientSecret = process.env.FLOWUS_CLIENT_SECRET;
  const redirectUri = process.env.FLOWUS_REDIRECT_URI;

  if (error) {
    return htmlResponse(`
      <h2>FlowUs \u6388\u6743\u5931\u8d25</h2>
      <p><strong>error:</strong> ${escapeHtml(error)}</p>
      <p><strong>description:</strong> ${escapeHtml(errorDescription || "\u672a\u77e5\u9519\u8bef")}</p>
    `, 400);
  }

  if (!code) {
    return htmlResponse(`
      <h2>\u7f3a\u5c11\u6388\u6743\u7801</h2>
      <p>\u5f53\u524d\u8bf7\u6c42\u6ca1\u6709\u643a\u5e26 <code>code</code> \u53c2\u6570\u3002</p>
      <p>\u8bf7\u4ece FlowUs \u6388\u6743\u5165\u53e3\u91cd\u65b0\u53d1\u8d77\u6388\u6743\u3002</p>
    `, 400);
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return htmlResponse(`
      <h2>\u670d\u52a1\u5668\u73af\u5883\u53d8\u91cf\u672a\u914d\u7f6e\u5b8c\u6574</h2>
      <p>\u8bf7\u5728 Vercel \u9879\u76ee\u91cc\u8865\u9f50\u4ee5\u4e0b\u53d8\u91cf\uff1a</p>
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
    tokenResponse = await fetch(tokenUrl, {
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
      <h2>\u8bf7\u6c42 FlowUs Token \u63a5\u53e3\u5931\u8d25</h2>
      <pre>${escapeHtml(String(err))}</pre>
    `, 500);
  }

  let tokenData;
  try {
    tokenData = JSON.parse(tokenDataText);
  } catch {
    return htmlResponse(`
      <h2>Token \u63a5\u53e3\u8fd4\u56de\u4e86\u975e JSON \u5185\u5bb9</h2>
      <p><strong>HTTP \u72b6\u6001:</strong> ${tokenResponse.status}</p>
      <pre>${escapeHtml(tokenDataText)}</pre>
    `, 500);
  }

  if (!tokenResponse.ok) {
    return htmlResponse(`
      <h2>FlowUs Token \u4ea4\u6362\u5931\u8d25</h2>
      <p><strong>HTTP \u72b6\u6001:</strong> ${tokenResponse.status}</p>
      <p><strong>state:</strong> ${escapeHtml(state || "")}</p>
      <pre>${escapeHtml(JSON.stringify(maskSecrets(tokenData), null, 2))}</pre>
    `, 500);
  }

  return htmlResponse(`
    <h2>FlowUs \u6388\u6743\u6210\u529f</h2>
    <p>\u5df2\u6536\u5230 <code>code</code>\uff0c\u5e76\u6210\u529f\u4ea4\u6362\u8bbf\u95ee\u4ee4\u724c\u3002</p>
    <p><strong>state:</strong> ${escapeHtml(state || "")}</p>
    <p>\u4f60\u73b0\u5728\u53ef\u4ee5\u5173\u95ed\u8fd9\u4e2a\u9875\u9762\uff0c\u56de\u5230\u4f60\u7684\u5ba2\u6237\u7aef\u7a0b\u5e8f\u3002</p>

    <details>
      <summary>\u8c03\u8bd5\u4fe1\u606f</summary>
      <pre>${escapeHtml(JSON.stringify(maskSecrets(tokenData), null, 2))}</pre>
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

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
