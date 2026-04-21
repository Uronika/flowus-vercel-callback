import { clearSessionCookieHeader } from "../../../../src/access-passcode.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  return Response.json({
    ok: true
  }, {
    headers: {
      "Set-Cookie": clearSessionCookieHeader(request)
    }
  });
}
