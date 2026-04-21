export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  const authError = authorize(request);
  if (authError) return json(authError.body, authError.status);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(errorBody("invalid_json", "Request body must be JSON."), 400);
  }

  try {
    const result = await handleAction(payload);
    return json(result.body, result.status);
  } catch (error) {
    return json(errorBody(error.code || "proxy_error", error.message), error.status || 500);
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
      if (payload.startCursor) params.set("start_cursor", payload.startCursor);
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

  const header = request.headers.get("authorization") || "";
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

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: CORS_HEADERS
  });
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
