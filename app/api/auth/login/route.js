import {
  createSessionForPasscode,
  publicAccessState,
  sessionCookieHeader
} from "../../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({
      ok: false,
      error: {
        code: "invalid_json",
        message: "\u8bf7\u8f93\u5165\u53e3\u4ee4\u3002"
      }
    }, { status: 400 });
  }

  try {
    const result = await createSessionForPasscode(payload.passcode, process.env);
    if (!result.ok) {
      return Response.json({
        ok: false,
        error: {
          code: result.code,
          message: "\u53e3\u4ee4\u4e0d\u6b63\u786e\u6216\u5df2\u8fc7\u671f\u3002"
        }
      }, { status: result.status });
    }

    return Response.json({
      ok: true,
      access: publicAccessState(result.state)
    }, {
      headers: {
        "Set-Cookie": sessionCookieHeader(result.cookieValue, request, process.env)
      }
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: {
        code: error.code || "server_error",
        message: error.message || "\u767b\u5f55\u5931\u8d25\u3002"
      }
    }, { status: error.status || 500 });
  }
}
