import {
  authorizeAdminRequest,
  publicAccessState,
  rotateAccessPasscode
} from "../../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!authorizeAdminRequest(request, process.env)) {
    return Response.json({
      ok: false,
      error: {
        code: "unauthorized",
        message: "Unauthorized."
      }
    }, { status: 401 });
  }

  try {
    const state = await rotateAccessPasscode(process.env, { reason: "manual" });
    return Response.json({
      ok: true,
      access: publicAccessState(state)
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: {
        code: error.code || "server_error",
        message: error.message || "Passcode rotation failed."
      }
    }, { status: error.status || 500 });
  }
}
