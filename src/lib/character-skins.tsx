import type { CSSProperties } from "react";

export const RAINBOW_COLORS = ["#8b3dff", "#2684ff", "#29c56f", "#ffe13b", "#ff3f45"];

export function drawRainbowCharacter(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  phase: number,
) {
  const layer = document.createElement("canvas");
  layer.width = Math.ceil(width);
  layer.height = Math.ceil(height);
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return;

  layerCtx.drawImage(image, 0, 0, width, height);
  layerCtx.globalCompositeOperation = "source-in";
  const travel = Math.sin(phase) * width * 0.18;
  const gradient = layerCtx.createLinearGradient(travel, 0, width + travel, height);
  RAINBOW_COLORS.forEach((color, index) => {
    gradient.addColorStop(index / (RAINBOW_COLORS.length - 1), color);
  });
  layerCtx.fillStyle = gradient;
  layerCtx.fillRect(0, 0, width, height);

  // Recupera luces y sombras de la foto para que siga pareciendo el personaje.
  layerCtx.globalCompositeOperation = "multiply";
  layerCtx.globalAlpha = 0.48;
  layerCtx.drawImage(image, 0, 0, width, height);
  layerCtx.globalAlpha = 1;
  layerCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer, x, y, width, height);
}

export function rainbowMaskStyle(url: string): CSSProperties {
  const mask = `url(${JSON.stringify(url)}) center / contain no-repeat`;
  return {
    WebkitMask: mask,
    mask,
    backgroundImage: `linear-gradient(135deg, ${RAINBOW_COLORS.join(", ")})`,
  };
}