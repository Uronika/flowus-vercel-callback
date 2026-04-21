import {
  authorizeCronRequest,
  publicAccessState,
  rotateAccessPasscode
} from "../../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!authorizeCronRequest(request, process.env)) {
    return Response.json({
      ok: false,
      error: {
        code: "unauthorized",
        message: "Unauthorized."
      }
    }, { status: 401 });
  }

  try {
    const state = await rotateAccessPasscode(process.env, { reason: "cron" });
    return Response.json({
      ok: true,
      access: publicAccessState(state)
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: {
        code: error.code || "server_error",
        message: error.message || "Cron passcode rotation failed."
      }
    }, { status: error.status || 500 });
  }
}
