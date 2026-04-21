export const DEFAULT_FLOWUS_API_BASE = "https://api.flowus.cn/v1";
export const DEFAULT_TASK_DATABASE_ID = "e5970787-783b-4afc-8819-184bd725109a";
export const DEFAULT_GTD_ROOT_ID = "0a338201-e356-4462-b029-48a257b0d6ce";
export const DEFAULT_ACCESS_PAGE_ID = "ef08b2f9-1295-415a-9628-2546e52dc738";

export function loadConfig(env = process.env) {
  const token = env.FLOWUS_TOKEN || env.FLOWUS_ACCESS_TOKEN || "";
  const proxyBase = env.FLOWUS_PROXY_BASE || "";
  const proxySecret = env.GTD_PROXY_SECRET || env.FLOWUS_PROXY_SECRET || "";

  return {
    apiBase: normalizeFlowUsRestBase(env.FLOWUS_REST_BASE || env.FLOWUS_API_BASE || DEFAULT_FLOWUS_API_BASE),
    proxyBase: stripTrailingSlash(proxyBase),
    proxySecret,
    token,
    taskDatabaseId: env.FLOWUS_TASK_DATABASE_ID || DEFAULT_TASK_DATABASE_ID,
    gtdRootId: env.FLOWUS_GTD_ROOT_ID || DEFAULT_GTD_ROOT_ID,
    accessPageId: env.GTD_ACCESS_PAGE_ID || DEFAULT_ACCESS_PAGE_ID
  };
}

export function requireToken(config) {
  if (config.proxyBase) {
    if (!config.proxySecret) {
      const error = new Error("Missing GTD proxy secret. Set GTD_PROXY_SECRET or FLOWUS_PROXY_SECRET.");
      error.code = "config_error";
      throw error;
    }
    return;
  }

  if (!config.token) {
    const error = new Error("Missing FlowUs access token or backend proxy config. Set FLOWUS_ACCESS_TOKEN, or FLOWUS_PROXY_BASE + GTD_PROXY_SECRET.");
    error.code = "config_error";
    throw error;
  }
}

function normalizeFlowUsRestBase(value) {
  const base = stripTrailingSlash(value);
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
