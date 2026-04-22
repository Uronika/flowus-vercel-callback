import { fetchTaskDetail, updateTaskFields } from "../../../../src/task-service.js";
import { validateAccessRequest } from "../../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const auth = await validateAccessRequest(request, process.env);
    if (!auth.ok) return unauthorized(auth.code, auth.status);

    const { id } = await params;
    const task = await fetchTaskDetail(id, process.env);
    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      task
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const auth = await validateAccessRequest(request, process.env);
    if (!auth.ok) return unauthorized(auth.code, auth.status);

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({
        ok: false,
        error: {
          code: "invalid_json",
          message: "\u8bf7\u6c42\u5185\u5bb9\u5fc5\u987b\u662f JSON\u3002"
        }
      }, { status: 400 });
    }

    const { id } = await params;
    const task = await updateTaskFields(id, body || {}, process.env);
    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      task
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function unauthorized(code, status = 401) {
  return Response.json({
    ok: false,
    error: {
      code,
      message: "\u8bf7\u5148\u8f93\u5165 FlowUs \u91cc\u7684\u5f53\u524d\u8bbf\u95ee\u53e3\u4ee4\u3002"
    }
  }, { status });
}

function toErrorResponse(error) {
  const status = error.code === "task_not_found" ? 404 : error.status || 500;
  return Response.json({
    ok: false,
    error: {
      code: error.code || "server_error",
      message: error.message || "\u8bfb\u53d6\u4efb\u52a1\u5931\u8d25\u3002"
    }
  }, { status });
}
