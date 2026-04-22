export class FlowUsClient {
  constructor(config) {
    this.config = config;
  }

  async queryDatabase(databaseId, body = {}) {
    if (this.config.proxyBase) {
      return this.proxyRequest("queryDatabase", { databaseId, body });
    }

    return this.request(`/databases/${databaseId}/query`, {
      method: "POST",
      body
    });
  }

  async getPage(pageId) {
    if (this.config.proxyBase) {
      return this.proxyRequest("getPage", { pageId });
    }

    return this.request(`/pages/${pageId}`, {
      method: "GET"
    });
  }

  async updatePage(pageId, body = {}) {
    if (this.config.proxyBase) {
      return this.proxyRequest("updatePage", { pageId, body });
    }

    return this.request(`/pages/${pageId}`, {
      method: "PATCH",
      body
    });
  }

  async getBlockChildren(blockId, { pageSize = 100, startCursor = null } = {}) {
    if (this.config.proxyBase) {
      return this.proxyRequest("getBlockChildren", { blockId, pageSize, startCursor });
    }

    const params = new URLSearchParams();
    params.set("page_size", String(pageSize));
    if (startCursor) params.set("start_cursor", startCursor);

    return this.request(`/blocks/${blockId}/children?${params.toString()}`, {
      method: "GET"
    });
  }

  async appendBlockChildren(blockId, children) {
    if (this.config.proxyBase) {
      return this.proxyRequest("appendBlockChildren", { blockId, children });
    }

    return this.request(`/blocks/${blockId}/children`, {
      method: "PATCH",
      body: { children }
    });
  }

  async updateBlock(blockId, body = {}) {
    if (this.config.proxyBase) {
      return this.proxyRequest("updateBlock", { blockId, body });
    }

    return this.request(`/blocks/${blockId}`, {
      method: "PATCH",
      body
    });
  }

  async fetchAllDatabasePages(databaseId) {
    const pages = [];
    let startCursor = null;

    do {
      const body = { page_size: 100 };
      if (startCursor) body.start_cursor = startCursor;
      const response = await this.queryDatabase(databaseId, body);
      pages.push(...(response.results || []));
      startCursor = response.has_more ? response.next_cursor : null;
    } while (startCursor);

    return pages;
  }

  async fetchAllBlockChildren(blockId) {
    const blocks = [];
    let startCursor = null;

    do {
      const response = await this.getBlockChildren(blockId, {
        pageSize: 100,
        startCursor
      });
      blocks.push(...(response.results || []));
      startCursor = response.has_more ? response.next_cursor : null;
    } while (startCursor);

    return blocks;
  }

  async request(path, { method, body } = {}) {
    const url = `${this.config.apiBase}${path}`;
    let response;

    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (cause) {
      throw createNetworkError(url, cause);
    }

    const text = await response.text();
    const data = text ? parseJson(text, response, url) : {};

    if (!response.ok || data.object === "error") {
      const error = new Error(data.message || `FlowUs API 请求失败：HTTP ${response.status}`);
      error.code = data.code || "flowus_error";
      error.status = data.status || response.status;
      error.details = data;
      throw error;
    }

    return data;
  }

  async proxyRequest(action, payload) {
    const url = `${this.config.proxyBase}/api/gtd`;
    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.proxySecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, ...payload })
      });
    } catch (cause) {
      throw createNetworkError(url, cause);
    }

    const text = await response.text();
    const data = text ? parseJson(text, response, url) : {};

    if (!response.ok || data.object === "error") {
      const error = new Error(data.message || `GTD 后端代理请求失败：HTTP ${response.status}`);
      error.code = data.code || "proxy_error";
      error.status = data.status || response.status;
      error.details = data;
      throw error;
    }

    return data;
  }
}

function createNetworkError(url, cause) {
  const causeCode = cause?.cause?.code || cause?.code || "";
  const causeMessage = cause?.cause?.message || cause?.message || String(cause);
  const causeText = causeCode ? `${causeCode}: ${causeMessage}` : causeMessage;
  const error = new Error(`无法连接 FlowUs API：${sanitizeUrl(url)}\n底层错误：${causeText}`);
  error.code = "network_error";
  error.status = 0;
  error.cause = cause;
  return error;
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      parsed.searchParams.set(key, "<redacted>");
    }
    return parsed.toString();
  } catch {
    return String(url).replace(/token=[^&]+/gi, "token=<redacted>");
  }
}

function parseJson(text, response = null, url = "") {
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error(`FlowUs API 返回了非 JSON 响应：HTTP ${response?.status || 0}`);
    error.code = "flowus_error";
    error.status = response?.status || 0;
    error.details = { body: text, url: sanitizeUrl(url) };
    throw error;
  }
}
