// Todos los personajes y sus variantes (skins). Lo usan el juego, el menú de personajes y el ranking.
// Las imágenes viven dentro del proyecto (no en el CDN de Lovable): así se ven
// en el servidor local y quedan empaquetadas en el APK sin depender de internet.
import kokiPng from "@/assets/koki-real.png";
import gatoNegroPng from "@/assets/gato-negro.png";
import bolaNievePng from "@/assets/bola-nieve.png";
import gufiPng from "@/assets/gufi.png";
import ratonPng from "@/assets/raton.png";
import kokiPixeladoPng from "@/assets/koki-pixelado.png";
import kokiPixelado2Png from "@/assets/koki-pixelado-2.png";
import kokiPixelado3Png from "@/assets/koki-pixelado-3.png";
import type { SkinFx } from "./character-skins";

export type Character = {
  id: string;
  name: string;
  url: string;
  price: number;
  base: string;
  filter?: string;
  fx?: SkinFx;
  /** no se compra: se gana al conseguir este logro (id de ACHIEVEMENTS) */
  achievement?: string;
  /** no se compra: se desbloquea escribiendo este código secreto (ver secret-codes.ts) */
  code?: string;
};

export const CHARACTERS: Character[] = [
  // base
  { id: "koki", name: "Koki", url: kokiPng, price: 0, base: "koki" },
  { id: "taz", name: "Taz", url: gatoNegroPng, price: 60, base: "taz" },
  { id: "gufi", name: "Gufi", url: gufiPng, price: 60, base: "gufi" },
  { id: "raton", name: "Ratón", url: ratonPng, price: 120, base: "raton" },

  // variantes de Koki
  { id: "koki-azul", name: "Koki Azul", url: kokiPng, price: 200, base: "koki", fx: "azul" },
  { id: "koki-rosa", name: "Koki Rosa", url: kokiPng, price: 300, base: "koki", fx: "rosa" },
  { id: "koki-verde", name: "Koki Verde", url: kokiPng, price: 400, base: "koki", fx: "verde" },
  { id: "koki-dorado", name: "Koki Dorado", url: kokiPng, price: 800, base: "koki", fx: "dorado" },

  // variantes de Taz
  {
    id: "taz-violeta",
    name: "Taz Violeta",
    url: gatoNegroPng,
    price: 250,
    base: "taz",
    fx: "violeta",
  },
  { id: "taz-fuego", name: "Taz Fuego", url: gatoNegroPng, price: 450, base: "taz", fx: "fuego" },
  { id: "taz-hielo", name: "Taz Hielo", url: gatoNegroPng, price: 600, base: "taz", fx: "hielo" },
  {
    id: "taz-bola-nieve",
    name: "Bola de Nieve",
    url: bolaNievePng,
    price: 50,
    base: "bola-nieve",
    fx: "nieve",
  },

  // variantes de Gufi
  {
    id: "gufi-crema",
    name: "Gufi Crema",
    url: gufiPng,
    price: 250,
    base: "gufi",
    filter: "saturate(0.5) brightness(1.35)",
  },
  {
    id: "gufi-menta",
    name: "Gufi Menta",
    url: gufiPng,
    price: 500,
    base: "gufi",
    filter: "hue-rotate(120deg) saturate(1.5) brightness(1.1)",
  },
  {
    id: "gufi-neon",
    name: "Gufi Neón",
    url: gufiPng,
    price: 700,
    base: "gufi",
    filter: "hue-rotate(290deg) saturate(3) brightness(1.2)",
  },

  // variantes de Ratón
  {
    id: "raton-blanco",
    name: "Ratón Blanco",
    url: ratonPng,
    price: 350,
    base: "raton",
    filter: "saturate(0.2) brightness(1.7)",
  },
  {
    id: "raton-cyber",
    name: "Ratón Cyber",
    url: ratonPng,
    price: 900,
    base: "raton",
    filter: "hue-rotate(200deg) saturate(3.5) brightness(1.25)",
  },
  {
    id: "raton-arcoiris",
    name: "Ratón Arcoíris",
    url: ratonPng,
    price: 1000,
    base: "raton",
    fx: "rainbow",
  },
  // se ganan con logros, no con pastelitos
  {
    id: "koki-pulento",
    name: "Koki Pulento",
    url: kokiPng,
    price: 0,
    base: "koki",
    fx: "acero",
    achievement: "boss-10",
  },
  {
    id: "koki-volao",
    name: "Koki Volao",
    url: kokiPng,
    price: 0,
    base: "koki",
    fx: "cosmos",
    achievement: "score-100",
  },
  {
    id: "taz-al-toque",
    name: "Taz Al Toque",
    url: gatoNegroPng,
    price: 0,
    base: "taz",
    fx: "electrico",
    achievement: "taz-60",
  },
  {
    id: "gufi-trasnochao",
    name: "Gufi Trasnochao",
    url: gufiPng,
    price: 0,
    base: "gufi",
    fx: "lunar",
    achievement: "streak-7",
  },
  {
    id: "raton-patiperro",
    name: "Ratón Patiperro",
    url: ratonPng,
    price: 0,
    base: "raton",
    fx: "arena",
    achievement: "missions-5",
  },
  {
    id: "bola-cuatica",
    name: "Bola Cuática",
    url: bolaNievePng,
    price: 0,
    base: "bola-nieve",
    fx: "aurora",
    achievement: "daily-10",
  },
  // el sprite de Koki de la versión de Game Boy Color: el reto más difícil
  {
    id: "koki-pixelado",
    name: "Koki Pixelado",
    url: kokiPixeladoPng,
    price: 0,
    base: "koki",
    achievement: "hard-500",
  },
  // variantes pixeladas secretas: se desbloquean con el código "hola manu"
  {
    id: "koki-pixelado-2",
    name: "Koki Pixelado 2",
    url: kokiPixelado2Png,
    price: 0,
    base: "koki",
    code: "hola manu",
  },
  {
    id: "koki-pixelado-3",
    name: "Koki Pixelado 3",
    url: kokiPixelado3Png,
    price: 0,
    base: "koki",
    code: "hola manu",
  },
];

export const CHAR_BY_ID: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);
