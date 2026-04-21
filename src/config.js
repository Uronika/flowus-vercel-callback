export const DEFAULT_FLOWUS_API_BASE = "https://api.flowus.cn/v1";
export const DEFAULT_TASK_DATABASE_ID = "e5970787-783b-4afc-8819-184bd725109a";
export const DEFAULT_GTD_ROOT_ID = "0a338201-e356-4462-b029-48a257b0d6ce";

export function loadConfig(env = process.env) {
  const token = env.FLOWUS_TOKEN || env.FLOWUS_ACCESS_TOKEN || "";
  const proxyBase = env.FLOWUS_PROXY_BASE || "";
  const proxySecret = env.GTD_PROXY_SECRET || env.FLOWUS_PROXY_SECRET || "";

  return {
    apiBase: stripTrailingSlash(env.FLOWUS_API_BASE || DEFAULT_FLOWUS_API_BASE),
    proxyBase: stripTrailingSlash(proxyBase),
    proxySecret,
    token,
    taskDatabaseId: env.FLOWUS_TASK_DATABASE_ID || DEFAULT_TASK_DATABASE_ID,
    gtdRootId: env.FLOWUS_GTD_ROOT_ID || DEFAULT_GTD_ROOT_ID
  };
}

export function requireToken(config) {
  if (config.proxyBase) {
    if (!config.proxySecret) {
      const error = new Error("缺少 GTD 后端代理密钥。请设置 GTD_PROXY_SECRET 或 FLOWUS_PROXY_SECRET。");
      error.code = "config_error";
      throw error;
    }
    return;
  }

  if (!config.token) {
    const error = new Error("缺少 FlowUs 访问令牌或后端代理配置。请设置 FLOWUS_ACCESS_TOKEN，或设置 FLOWUS_PROXY_BASE + GTD_PROXY_SECRET。");
    error.code = "config_error";
    throw error;
  }
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
