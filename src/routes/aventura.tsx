import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdventureGame } from "@/lib/adventure/game";
import { webIsOpen } from "@/lib/web-hours";

// Koki Adventure, el modo de plataformas (prototipo): una página aparte mientras se prueba.
export const Route = createFileRoute("/aventura")({
  head: () => ({ meta: [{ title: "Koki Adventure" }] }),
  component: AdventurePage,
});

/* el mismo horario de la web que el juego principal (src/lib/web-hours.ts; el APK no tiene horario) */
function AdventurePage() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const apply = () => setOpen(webIsOpen());
    apply();
    const t = setInterval(apply, 30000);
    return () => clearInterval(t);
  }, []);
  if (!open) return <div style={{ position: "fixed", inset: 0, background: "#0d1226" }} />;
  return (
    <AdventureGame
      onExit={() => {
        window.location.href = "/";
      }}
    />
  );
}
