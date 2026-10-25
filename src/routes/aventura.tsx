import { createFileRoute } from "@tanstack/react-router";
import { AdventureGame } from "@/lib/adventure/game";
import { WebGate } from "@/lib/web-gate";

// Koki Adventure, el modo de plataformas (prototipo): una página aparte mientras se prueba.
export const Route = createFileRoute("/aventura")({
  head: () => ({ meta: [
    { title: "Koki Adventure — Aventura de KokiCat" },
    { name: "description", content: "Explora el mundo de plataformas de KokiCat con Koki." },
    { property: "og:title", content: "Koki Adventure — Aventura de KokiCat" },
    { property: "og:description", content: "La aventura de plataformas del gato Koki." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AdventurePage,
});

/* el mismo horario de la web que el juego principal (src/lib/web-hours.ts; el APK no tiene horario) */
function AdventurePage() {
  return (
    <WebGate>{() =>
    <AdventureGame
      onExit={() => {
        window.location.href = "/";
      }}
    />
    }</WebGate>
  );
}
