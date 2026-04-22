import { deleteTaskStep, updateTaskStep } from "../../../../../../src/task-service.js";
import { validateAccessRequest } from "../../../../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const auth = await validateAccessRequest(request, process.env);
    if (!auth.ok) return unauthorized(auth.code, auth.status);

    let body;
    try {
      body = await request.json();
    } catch {
      return invalidJson();
    }

    const { id, stepId } = await params;
    const task = await updateTaskStep(id, stepId, body || {}, process.env);
    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      task
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await validateAccessRequest(request, process.env);
    if (!auth.ok) return unauthorized(auth.code, auth.status);

    const { id, stepId } = await params;
    const task = await deleteTaskStep(id, stepId, process.env);
    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      task
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function invalidJson() {
  return Response.json({
    ok: false,
    error: {
      code: "invalid_json",
      message: "\u8bf7\u6c42\u5185\u5bb9\u5fc5\u987b\u662f JSON\u3002"
    }
  }, { status: 400 });
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
  const status = ["task_not_found", "step_not_found"].includes(error.code) ? 404 : error.status || 500;
  return Response.json({
    ok: false,
    error: {
      code: error.code || "server_error",
      message: error.message || "\u5199\u5165\u6b65\u9aa4\u5931\u8d25\u3002"
    }
  }, { status });
}
