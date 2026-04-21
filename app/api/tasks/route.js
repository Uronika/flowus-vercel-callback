import { fetchTasks } from "../../../src/task-service.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authResponse = authorizeView(request);
  if (authResponse) return authResponse;

  try {
    const tasks = await fetchTasks(process.env);
    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      tasks
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function authorizeView(request) {
  const expected = process.env.GTD_WEB_VIEW_TOKEN || "";
  if (!expected) return null;

  const actual = request.headers.get("x-gtd-view-token") || "";
  if (actual === expected) return null;

  return Response.json({
    ok: false,
    error: {
      code: "unauthorized",
      message: "\u8bf7\u8f93\u5165\u67e5\u770b\u53e3\u4ee4\u3002"
    }
  }, { status: 401 });
}

function toErrorResponse(error) {
  return Response.json({
    ok: false,
    error: {
      code: error.code || "server_error",
      message: error.message || "\u8bfb\u53d6\u4efb\u52a1\u5931\u8d25\u3002"
    }
  }, { status: error.status || 500 });
}
