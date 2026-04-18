export function GET(request) {
  return new Response("FlowUs callback is alive", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}