import { createFileRoute } from "@tanstack/react-router";

// POST /api/challenge — envía la notificación push "X quiere jugar contigo".
// La app de Android llama aquí desde otro origen, por eso los encabezados CORS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/challenge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const { handleChallenge } = await import("@/lib/challenge.server");
        return handleChallenge(request, CORS);
      },
    },
  },
});
