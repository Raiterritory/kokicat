# KokiCat for PS4 (homebrew)

Native version of KokiCat for a PS4 with GoldHEN, written in C with the
[OpenOrbis toolchain](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain). It has the
Koki mode (normal and difficult) and the online ranking shared with the phone
(sign in with the same nickname and password).

- `src/core.c`: the game, its screens, the ranking and the login. Plain C with no libraries; it draws
  into a 1280x720 picture.
- `src/main_ps4.c`: the PS4 side (screen, controller, HTTPS, saves in `/data/kokicat`).
- `test/`: the same core compiled to WebAssembly, run with fake buttons and a fake server; it saves
  screenshots to `test/out/`.

## Build

Needs (in `C:\ps4tools`, or pass `-Toolchain` / `-Llvm`):
- OpenOrbis PS4 Toolchain v0.5.4 (`toolchain-llvm-18.tar.gz`), extracted to `C:\ps4tools\oo`
- LLVM 18 (`LLVM-18.1.8-win64.exe`, extracted with 7-Zip to `C:\ps4tools\llvm`)
- .NET 8 or newer, and bun

```powershell
powershell -ExecutionPolicy Bypass -File ps4/build.ps1 -Version 1.00
```

The package ends up in `ps4/out/KokiCat-PS4-v1.00.pkg`.

## Test on the PC

```bash
C:/ps4tools/llvm/bin/clang.exe --target=wasm32 -O2 -ffreestanding -nostdlib -Wl,--no-entry -Wl,--export-memory -o ps4/test/out/core.wasm ps4/src/core.c ps4/test/main_wasm.c
bun ps4/test/run.ts
```

## Controls

| Button | Action |
|---|---|
| ✕ / OPTIONS | Jump, choose |
| D-pad / left stick | Move through the menus |
| ◯ | Back |
| < > (ranking) | Switch between normal and difficult |
| △ (ranking) | Refresh |
| Keyboard: □ / △ / OPTIONS | Delete / capitals / done |
