export async function POST(request) {
  const authError = authorize(request);
  if (authError) {
    return jsonResponse(authError.body, authError.status);
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(errorBody("invalid_json", "Request body must be JSON."), 400);
  }

  try {
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

      default:
        return jsonResponse(errorBody("unsupported_action", `Unsupported proxy action: ${payload.action || "<empty>"}`), 400);
    }
  } catch (error) {
    return jsonResponse(errorBody(error.code || "proxy_error", error.message), error.status || 500);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

async function forwardFlowUs(path, { method, body }) {
  const token = getFlowUsToken();
  const url = `${getFlowUsRestBase()}${path}`;
  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (cause) {
    return jsonResponse(
      errorBody(
        "flowus_network_error",
        `Vercel backend could not connect to FlowUs API: ${cause?.cause?.code || cause?.code || cause?.message || String(cause)}`
      ),
      502
    );
  }

  const text = await response.text();
  const data = text ? parseJsonOrText(text) : {};
  return jsonResponse(data, response.status);
}

function authorize(request) {
  const expected = process.env.GTD_PROXY_SECRET || process.env.FLOWUS_PROXY_SECRET;
  if (!expected) {
    return {
      status: 500,
      body: errorBody("proxy_secret_missing", "Server is missing GTD_PROXY_SECRET or FLOWUS_PROXY_SECRET.")
    };
  }

  const header = getHeader(request, "authorization") || "";
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

async function readJsonBody(request) {
  if (typeof request.json === "function") {
    return request.json();
  }

  const text = await readTextBody(request);
  return JSON.parse(text);
}

async function readTextBody(request) {
  if (typeof request.text === "function") {
    return request.text();
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function getHeader(request, name) {
  const headers = request.headers || {};
  if (typeof headers.get === "function") {
    return headers.get(name);
  }
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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
