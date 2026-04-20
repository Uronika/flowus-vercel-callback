export default async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, errorBody("method_not_allowed", "Use POST."), 405);
    return;
  }

  const authError = authorize(request);
  if (authError) {
    sendJson(response, authError.body, authError.status);
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    sendJson(response, errorBody("invalid_json", "Request body must be JSON."), 400);
    return;
  }

  try {
    const result = await handleAction(payload);
    sendJson(response, result.body, result.status);
  } catch (error) {
    sendJson(response, errorBody(error.code || "proxy_error", error.message), error.status || 500);
  }
}

async function handleAction(payload) {
  switch (payload.action) {
    case "queryDatabase":
      assertId(payload.databaseId, "databaseId");
      return forwardFlowUs(`/databases/${encodeURIComponent(payload.databaseId)}/query`, {
        method: "POST",
        body: payload.body || {}
      });

    case "getPage":
      assertId(payload.pageId, "pageId");
      return forwardFlowUs(`/pages/${encodeURIComponent(payload.pageId)}`, {
        method: "GET"
      });

    case "getBlockChildren": {
      assertId(payload.blockId, "blockId");
      const params = new URLSearchParams();
      params.set("page_size", String(payload.pageSize || 100));
      if (payload.startCursor) {
        params.set("start_cursor", payload.startCursor);
      }
      return forwardFlowUs(`/blocks/${encodeURIComponent(payload.blockId)}/children?${params.toString()}`, {
        method: "GET"
      });
    }

    case "createPage":
      assertObject(payload.body, "body");
      return forwardFlowUs("/pages", {
        method: "POST",
        body: payload.body
      });

    case "updatePage":
      assertId(payload.pageId, "pageId");
      assertObject(payload.body, "body");
      return forwardFlowUs(`/pages/${encodeURIComponent(payload.pageId)}`, {
        method: "PATCH",
        body: payload.body
      });

    case "appendBlockChildren":
      assertId(payload.blockId, "blockId");
      if (!Array.isArray(payload.children)) {
        const error = new Error("Missing children.");
        error.code = "invalid_args";
        error.status = 400;
        throw error;
      }
      return forwardFlowUs(`/blocks/${encodeURIComponent(payload.blockId)}/children`, {
        method: "PATCH",
        body: { children: payload.children }
      });

    case "updateBlock":
      assertId(payload.blockId, "blockId");
      assertObject(payload.body, "body");
      return forwardFlowUs(`/blocks/${encodeURIComponent(payload.blockId)}`, {
        method: "PATCH",
        body: payload.body
      });

    default:
      return {
        status: 400,
        body: errorBody("unsupported_action", `Unsupported proxy action: ${payload.action || "<empty>"}`)
      };
  }
}

async function forwardFlowUs(path, { method, body }) {
  const token = getFlowUsToken();
  const url = `${getFlowUsRestBase()}${path}`;
  let upstream;

  try {
    upstream = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (cause) {
    return {
      status: 502,
      body: errorBody(
        "flowus_network_error",
        `Vercel backend could not connect to FlowUs API: ${cause?.cause?.code || cause?.code || cause?.message || String(cause)}`
      )
    };
  }

  const text = await upstream.text();
  return {
    status: upstream.status,
    body: text ? parseJsonOrText(text) : {}
  };
}

function authorize(request) {
  const expected = process.env.GTD_PROXY_SECRET || process.env.FLOWUS_PROXY_SECRET;
  if (!expected) {
    return {
      status: 500,
      body: errorBody("proxy_secret_missing", "Server is missing GTD_PROXY_SECRET or FLOWUS_PROXY_SECRET.")
    };
  }

  const header = getHeader(request, "authorization");
  const actual = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (actual !== expected) {
    return {
      status: 401,
      body: errorBody("unauthorized", "Proxy authorization failed.")
    };
  }

  return null;
}

function getFlowUsToken() {
  const token = process.env.FLOWUS_ACCESS_TOKEN || process.env.FLOWUS_TOKEN || process.env.FLOWUS_BOT_TOKEN;
  if (!token) {
    const error = new Error("Server is missing FLOWUS_ACCESS_TOKEN, FLOWUS_TOKEN, or FLOWUS_BOT_TOKEN.");
    error.code = "flowus_token_missing";
    error.status = 500;
    throw error;
  }
  return token;
}

function getFlowUsRestBase() {
  const configured = stripTrailingSlash(
    process.env.FLOWUS_REST_BASE || process.env.FLOWUS_API_BASE || "https://api.flowus.cn"
  );
  return configured.endsWith("/v1") ? configured : `${configured}/v1`;
}

function assertId(value, name) {
  if (!value || typeof value !== "string") {
    const error = new Error(`Missing ${name}.`);
    error.code = "invalid_args";
    error.status = 400;
    throw error;
  }
}

function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error(`Missing ${name}.`);
    error.code = "invalid_args";
    error.status = 400;
    throw error;
  }
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object" && !isReadable(request)) {
    return request.body;
  }

  const text = await readTextBody(request);
  return JSON.parse(text);
}

async function readTextBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isReadable(value) {
  return typeof value.on === "function" || typeof value[Symbol.asyncIterator] === "function";
}

function getHeader(request, name) {
  const headers = request.headers || {};
  return headers[name] || headers[name.toLowerCase()] || "";
}

function parseJsonOrText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { object: "raw", body: text };
  }
}

function errorBody(code, message) {
  return {
    object: "error",
    code,
    message
  };
}

function sendJson(response, body, status = 200) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
