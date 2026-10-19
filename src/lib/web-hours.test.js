import { test, expect } from "bun:test";
import { isNativeApp, webIsOpen, chileHour, WEB_OPEN_HOUR, WEB_CLOSE_HOUR } from "./web-hours.ts";

// Ventana de un navegador normal (la web publicada).
const WEB_WIN = {
  navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36" },
  location: { protocol: "https:" },
  document: { querySelector: () => null },
};

// El APK de Android: mismo código, pero con el marcador del build estático.
const APK_WIN = { ...WEB_WIN, __KOKICAT_APK__: true };
// APK con el puente de Capacitor cargado.
const CAP_WIN = { ...WEB_WIN, Capacitor: { isNativePlatform: () => true } };
// APK sin isNativePlatform pero con getPlatform.
const CAP_PLATFORM_WIN = { ...WEB_WIN, Capacitor: { getPlatform: () => "android" } };
// WebView de Android sin puente visible (Capacitor todavía no terminó de cargar).
const WEBVIEW_WIN = {
  ...WEB_WIN,
  navigator: { userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36" },
};
WEBVIEW_WIN.navigator.userAgent = WEBVIEW_WIN.navigator.userAgent.replace("Chrome/120.0", "Chrome/120.0 Mobile; wv)");
// APK abierto con esquema propio de la app.
const SCHEME_WIN = { ...WEB_WIN, location: { protocol: "capacitor:" } };
// Página que trae el meta tag del APK.
const META_WIN = { ...WEB_WIN, document: { querySelector: (s) => (s.includes("kokicat-app") ? {} : null) } };

test("el horario solo aplica a la web: a las 22:00 la web está cerrada", () => {
  expect(webIsOpen(WEB_WIN, 22)).toBe(false);
  expect(webIsOpen(WEB_WIN, 9)).toBe(false);
});

test("la web está abierta de 10:00 a 20:59 (hora de Chile)", () => {
  expect(webIsOpen(WEB_WIN, 10)).toBe(true);
  expect(webIsOpen(WEB_WIN, 20)).toBe(true);
  expect(webIsOpen(WEB_WIN, 21)).toBe(false);
  expect(WEB_OPEN_HOUR).toBe(10);
  expect(WEB_CLOSE_HOUR).toBe(21);
});

test("el APK con el marcador del build juega a cualquier hora", () => {
  expect(isNativeApp(APK_WIN)).toBe(true);
  expect(webIsOpen(APK_WIN, 22)).toBe(true);
  expect(webIsOpen(APK_WIN, 3)).toBe(true);
});

test("el APK con Capacitor juega a cualquier hora", () => {
  expect(isNativeApp(CAP_WIN)).toBe(true);
  expect(webIsOpen(CAP_WIN, 23)).toBe(true);
  expect(isNativeApp(CAP_PLATFORM_WIN)).toBe(true);
  expect(webIsOpen(CAP_PLATFORM_WIN, 0)).toBe(true);
});

test("el APK se reconoce aunque Capacitor no haya cargado", () => {
  expect(isNativeApp(WEBVIEW_WIN)).toBe(true);
  expect(webIsOpen(WEBVIEW_WIN, 22)).toBe(true);
  expect(isNativeApp(SCHEME_WIN)).toBe(true);
  expect(webIsOpen(SCHEME_WIN, 22)).toBe(true);
  expect(isNativeApp(META_WIN)).toBe(true);
  expect(webIsOpen(META_WIN, 22)).toBe(true);
});

test("Capacitor diciendo que es web no abre la web fuera de horario", () => {
  const win = { ...WEB_WIN, Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" } };
  expect(isNativeApp(win)).toBe(false);
  expect(webIsOpen(win, 22)).toBe(false);
});

test("la hora de Chile siempre cae entre 0 y 23", () => {
  const h = chileHour();
  expect(h).toBeGreaterThanOrEqual(0);
  expect(h).toBeLessThanOrEqual(23);
});
