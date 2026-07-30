# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Build estático para APK offline

```bash
bun run build:static
```

Genera `dist-static/` con `index.html` + todos los assets (imágenes y música
descargadas dentro del bundle). Esa carpeta funciona sin servidor ni internet
y es la que se empaqueta con Capacitor (`webDir: "dist-static"`) o PWABuilder
para producir el APK.

Si el dev server no está corriendo, indica de dónde bajar los assets:

```bash
ASSET_BASE=https://koki-cat-flap.lovable.app bun run build:static
```
