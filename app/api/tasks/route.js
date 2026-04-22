import { createDefaultTask, fetchTasks } from "../../../src/task-service.js";
import { validateAccessRequest } from "../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const auth = await validateAccessRequest(request, process.env);
    if (!auth.ok) return unauthorized(auth.code, auth.status);

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

export async function POST(request) {
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

    const task = await createDefaultTask({
      list: body?.list,
      title: body?.title
    }, process.env);

    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      task
    }, { status: 201 });
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
  return Response.json({
    ok: false,
    error: {
      code: error.code || "server_error",
      message: error.message || "\u8bfb\u53d6\u4efb\u52a1\u5931\u8d25\u3002"
    }
  }, { status: error.status || 500 });
}
