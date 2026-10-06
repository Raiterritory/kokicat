// Todos los personajes y sus variantes (skins). Lo usan el juego, el menú de personajes y el ranking.
import kokiAsset from "@/assets/koki-real.png.asset.json";
import gatoNegroPng from "@/assets/gato-negro.png";
import bolaNievePng from "@/assets/bola-nieve.png";
import gufiAsset from "@/assets/gufi.png.asset.json";
import ratonAsset from "@/assets/raton.png.asset.json";
import type { SkinFx } from "./character-skins";

export type Character = {
  id: string;
  name: string;
  url: string;
  price: number;
  base: string;
  filter?: string;
  fx?: SkinFx;
};

export const CHARACTERS: Character[] = [
  // base
  { id: "koki", name: "Koki", url: kokiAsset.url, price: 0, base: "koki" },
  { id: "taz", name: "Taz", url: gatoNegroPng, price: 60, base: "taz" },
  { id: "gufi", name: "Gufi", url: gufiAsset.url, price: 60, base: "gufi" },
  { id: "raton", name: "Ratón", url: ratonAsset.url, price: 120, base: "raton" },

  // variantes de Koki
  { id: "koki-azul", name: "Koki Azul", url: kokiAsset.url, price: 200, base: "koki", fx: "azul" },
  { id: "koki-rosa", name: "Koki Rosa", url: kokiAsset.url, price: 300, base: "koki", fx: "rosa" },
  { id: "koki-verde", name: "Koki Verde", url: kokiAsset.url, price: 400, base: "koki", fx: "verde" },
  { id: "koki-dorado", name: "Koki Dorado", url: kokiAsset.url, price: 800, base: "koki", fx: "dorado" },

  // variantes de Taz
  { id: "taz-violeta", name: "Taz Violeta", url: gatoNegroPng, price: 250, base: "taz", fx: "violeta" },
  { id: "taz-fuego", name: "Taz Fuego", url: gatoNegroPng, price: 450, base: "taz", fx: "fuego" },
  { id: "taz-hielo", name: "Taz Hielo", url: gatoNegroPng, price: 600, base: "taz", fx: "hielo" },
  { id: "taz-bola-nieve", name: "Bola de Nieve", url: bolaNievePng, price: 50, base: "bola-nieve" },

  // variantes de Gufi
  { id: "gufi-crema", name: "Gufi Crema", url: gufiAsset.url, price: 250, base: "gufi", filter: "saturate(0.5) brightness(1.35)" },
  { id: "gufi-menta", name: "Gufi Menta", url: gufiAsset.url, price: 500, base: "gufi", filter: "hue-rotate(120deg) saturate(1.5) brightness(1.1)" },
  { id: "gufi-neon", name: "Gufi Neón", url: gufiAsset.url, price: 700, base: "gufi", filter: "hue-rotate(290deg) saturate(3) brightness(1.2)" },

  // variantes de Ratón
  { id: "raton-blanco", name: "Ratón Blanco", url: ratonAsset.url, price: 350, base: "raton", filter: "saturate(0.2) brightness(1.7)" },
  { id: "raton-cyber", name: "Ratón Cyber", url: ratonAsset.url, price: 900, base: "raton", filter: "hue-rotate(200deg) saturate(3.5) brightness(1.25)" },
  { id: "raton-arcoiris", name: "Ratón Arcoíris", url: ratonAsset.url, price: 1000, base: "raton", fx: "rainbow" },
];

export const CHAR_BY_ID: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);
