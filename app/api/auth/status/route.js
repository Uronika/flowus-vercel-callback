import {
  publicAccessState,
  validateAccessRequest
} from "../../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const auth = await validateAccessRequest(request, process.env);
    return Response.json({
      ok: true,
      authenticated: auth.ok,
      access: auth.ok ? publicAccessState(auth.state) : null
    }, { status: auth.ok ? 200 : 401 });
  } catch (error) {
    return Response.json({
      ok: false,
      authenticated: false,
      error: {
        code: error.code || "server_error",
        message: error.message || "\u8bfb\u53d6\u767b\u5f55\u72b6\u6001\u5931\u8d25\u3002"
      }
    }, { status: error.status || 500 });
  }
}
