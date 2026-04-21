import crypto from "node:crypto";
import { loadConfig, requireToken } from "./config.js";
import { FlowUsClient } from "./flowus-client.js";

export const ACCESS_COOKIE = "gtd_session";
export const DEFAULT_SESSION_TTL_SECONDS = 26 * 60 * 60;
export const DEFAULT_PASSCODE_TTL_MS = 24 * 60 * 60 * 1000;

const PASSCODE_RE = /当前访问口令：([^\n]+)/;
const UPDATED_RE = /更新时间：([^\n]+)/;
const EXPIRES_RE = /有效期到：([^\n]+)/;

export async function getAccessState(env = process.env, { rotateIfExpired = true } = {}) {
  const { client, config } = createAccessClient(env);
  const state = await readAccessState(client, config.accessPageId);

  if (!rotateIfExpired || (state.passcode && state.expiresAt && Date.parse(state.expiresAt) > Date.now())) {
    return state;
  }

  return rotateAccessPasscode(env, { reason: state.passcode ? "expired" : "missing" });
}

export async function rotateAccessPasscode(env = process.env, { reason = "manual" } = {}) {
  const { client, config } = createAccessClient(env);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getPasscodeTtlMs(env));
  const passcode = generatePasscode();
  const content = buildAccessPageContent({
    passcode,
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    reason
  });

  await writeAccessState(client, config.accessPageId, content);

  return {
    passcode,
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    reason
  };
}

export async function validateAccessRequest(request, env = process.env) {
  const cookieValue = readCookie(request.headers.get("cookie") || "", ACCESS_COOKIE);
  if (!cookieValue) return { ok: false, status: 401, code: "missing_session" };

  const state = await getAccessState(env);
  if (!state.passcode) return { ok: false, status: 500, code: "passcode_missing" };

  const result = verifySessionCookie(cookieValue, state.passcode, env);
  if (!result.ok) return result;

  return { ok: true, state };
}

export async function createSessionForPasscode(passcode, env = process.env) {
  const state = await getAccessState(env);
  if (!state.passcode || normalizePasscode(passcode) !== normalizePasscode(state.passcode)) {
    return { ok: false, status: 401, code: "invalid_passcode" };
  }

  const issuedAt = Date.now();
  const cookieValue = signSessionCookie(state.passcode, issuedAt, env);
  return {
    ok: true,
    cookieValue,
    maxAge: getSessionTtlSeconds(env),
    state
  };
}

export function sessionCookieHeader(cookieValue, request, env = process.env) {
  return serializeCookie(ACCESS_COOKIE, cookieValue, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "Lax",
    path: "/",
    maxAge: getSessionTtlSeconds(env)
  });
}

export function clearSessionCookieHeader(request) {
  return serializeCookie(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "Lax",
    path: "/",
    maxAge: 0
  });
}

export function authorizeAdminRequest(request, env = process.env) {
  const expected = env.GTD_PROXY_SECRET || env.FLOWUS_PROXY_SECRET || env.CRON_SECRET || "";
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

export function authorizeCronRequest(request, env = process.env) {
  const cronSecret = env.CRON_SECRET || "";
  const header = request.headers.get("authorization") || "";
  if (cronSecret) return header === `Bearer ${cronSecret}`;

  if (authorizeAdminRequest(request, env)) return true;

  const userAgent = request.headers.get("user-agent") || "";
  return userAgent.includes("vercel-cron");
}

export function publicAccessState(state) {
  return {
    updatedAt: state.updatedAt || null,
    expiresAt: state.expiresAt || null
  };
}

function createAccessClient(env) {
  const config = loadConfig(env);
  requireToken(config);
  return {
    client: new FlowUsClient(config),
    config
  };
}

async function readAccessState(client, pageId) {
  const blocks = await client.fetchAllBlockChildren(pageId);
  const text = blocks.map(blockText).filter(Boolean).join("\n");

  return {
    blockId: findWritableBlock(blocks)?.id || "",
    passcode: matchField(text, PASSCODE_RE),
    updatedAt: matchField(text, UPDATED_RE),
    expiresAt: matchField(text, EXPIRES_RE),
    rawText: text
  };
}

async function writeAccessState(client, pageId, content) {
  const blocks = await client.fetchAllBlockChildren(pageId);
  const block = findWritableBlock(blocks);

  if (block) {
    return client.updateBlock(block.id, paragraphBody(content));
  }

  return client.appendBlockChildren(pageId, [{
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [plainText(content)]
    }
  }]);
}

function buildAccessPageContent({ passcode, updatedAt, expiresAt, reason }) {
  return [
    `当前访问口令：${passcode}`,
    `更新时间：${updatedAt}`,
    `有效期到：${expiresAt}`,
    `说明：用于访问 FlowUs GTD 公网页面。请不要把这个页面分享给他人。`,
    `刷新原因：${reason}`
  ].join("\n");
}

function generatePasscode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let value = "";
  for (const byte of bytes) {
    value += alphabet[byte % alphabet.length];
  }
  return `GTD-${value.slice(0, 4)}-${value.slice(4, 8)}`;
}

function signSessionCookie(passcode, issuedAt, env) {
  const signature = sign(`${normalizePasscode(passcode)}.${issuedAt}`, getSessionSecret(env));
  return `${issuedAt}.${signature}`;
}

function verifySessionCookie(value, passcode, env) {
  const [issuedAtText, signature] = String(value || "").split(".");
  const issuedAt = Number(issuedAtText);
  if (!Number.isFinite(issuedAt) || !signature) {
    return { ok: false, status: 401, code: "invalid_session" };
  }

  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0 || ageMs > getSessionTtlSeconds(env) * 1000) {
    return { ok: false, status: 401, code: "expired_session" };
  }

  const expected = sign(`${normalizePasscode(passcode)}.${issuedAt}`, getSessionSecret(env));
  if (!safeEqual(signature, expected)) {
    return { ok: false, status: 401, code: "stale_session" };
  }

  return { ok: true };
}

function getSessionSecret(env) {
  const secret = env.GTD_SESSION_SECRET || env.GTD_PROXY_SECRET || env.FLOWUS_CLIENT_SECRET || "";
  if (!secret) {
    const error = new Error("Missing GTD_SESSION_SECRET, GTD_PROXY_SECRET, or FLOWUS_CLIENT_SECRET.");
    error.code = "session_secret_missing";
    error.status = 500;
    throw error;
  }
  return secret;
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizePasscode(value) {
  return String(value || "").trim().toUpperCase();
}

function getSessionTtlSeconds(env) {
  return Number(env.GTD_SESSION_TTL_SECONDS || DEFAULT_SESSION_TTL_SECONDS);
}

function getPasscodeTtlMs(env) {
  return Number(env.GTD_PASSCODE_TTL_MS || DEFAULT_PASSCODE_TTL_MS);
}

function shouldUseSecureCookie(request) {
  const url = new URL(request.url);
  return url.protocol === "https:" || process.env.VERCEL === "1";
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function readCookie(header, name) {
  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
    ? decodeURIComponent(header
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      .slice(name.length + 1))
    : "";
}

function matchField(text, regex) {
  return (text.match(regex)?.[1] || "").trim();
}

function findWritableBlock(blocks) {
  return blocks.find((block) => block.type === "paragraph") || null;
}

function paragraphBody(content) {
  return {
    paragraph: {
      rich_text: [plainText(content)]
    }
  };
}

function plainText(content) {
  return {
    type: "text",
    text: {
      content,
      link: null
    },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default"
    },
    plain_text: content,
    href: null
  };
}

function blockText(block) {
  const data = block[block.type] || {};
  return (data.rich_text || [])
    .map((item) => item.plain_text || item.text?.content || "")
    .join("");
}
