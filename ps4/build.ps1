# Builds the KokiCat PS4 package (homebrew .pkg for GoldHEN) into ps4/out/.
# Needs the OpenOrbis toolchain and LLVM 18 (default: C:\ps4tools, see ps4/README.md).
# Usage (from the repo root):  powershell -File ps4/build.ps1
param(
  [string]$Toolchain = "C:\ps4tools\oo\OpenOrbis\PS4Toolchain",
  [string]$Llvm = "C:\ps4tools\llvm\bin",
  [string]$Version = "1.00"
)
$ErrorActionPreference = "Stop"
$env:OO_PS4_TOOLCHAIN = $Toolchain # create-fself lo pide
$env:DOTNET_ROLL_FORWARD = "Major"  # PkgTool pide .NET 3.0; así corre con el .NET instalado (8 o más nuevo)
$ps4 = $PSScriptRoot
$repo = Split-Path $ps4 -Parent
$build = Join-Path $ps4 "build"
$stage = Join-Path $build "pkg"
$out = Join-Path $ps4 "out"

$TitleId = "KOKC00001"
$ContentId = "IV0000-KOKC00001_00-KOKICATPS4000000"

function Run($exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "$exe failed ($LASTEXITCODE)" }
}

Remove-Item -Recurse -Force $build -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $build, "$stage\sce_sys\about", "$stage\sce_module", "$stage\assets", $out | Out-Null

# 1) servidor del juego: la URL y la clave pública (la misma que usa la app) salen de .env
$envFile = Get-Content (Join-Path $repo ".env")
$url = ($envFile | Where-Object { $_ -match '^VITE_SUPABASE_URL=' }) -replace '^VITE_SUPABASE_URL=', '' -replace '"', ''
$key = ($envFile | Where-Object { $_ -match '^VITE_SUPABASE_PUBLISHABLE_KEY=' }) -replace '^VITE_SUPABASE_PUBLISHABLE_KEY=', '' -replace '"', ''
if (-not $url -or -not $key) { throw "faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en .env" }
"#define SERVER_URL `"$url`"`n#define SERVER_KEY `"$key`"`n" | Set-Content -Encoding ascii (Join-Path $build "server_config.h")

# 2) imágenes: Koki y el logo están publicados con la app (Lovable); el pastelito está en el repo
$src = Join-Path $ps4 "assets-src"
New-Item -ItemType Directory -Force $src | Out-Null
foreach ($name in @("koki-real", "koki-menu-logo")) {
  $dst = Join-Path $src "$name.png"
  if (-not (Test-Path $dst)) {
    $asset = Get-Content (Join-Path $repo "src\assets\$name.png.asset.json") -Raw | ConvertFrom-Json
    Invoke-WebRequest -UseBasicParsing -Uri ("https://kokicat.lovable.app" + $asset.url) -OutFile $dst
  }
}
Copy-Item (Join-Path $repo "src\assets\pastelito.png") $src -Force
Run bun @("$ps4\tools\png2rgba.ts", "$ps4\assets-src\koki-real.png", "$stage\assets\koki.rgba", "128")
Run bun @("$ps4\tools\png2rgba.ts", "$ps4\assets-src\koki-menu-logo.png", "$stage\assets\logo.rgba", "640")
Run bun @("$ps4\tools\png2rgba.ts", "$ps4\assets-src\pastelito.png", "$stage\assets\coin.rgba", "64")
Run bun @("$ps4\tools\make-icon.ts", "$ps4\assets-src\koki-menu-logo.png", "$stage\sce_sys\icon0.png")

# 3) compilar y enlazar para la PS4
$cflags = @("--target=x86_64-pc-freebsd12-elf", "-fPIC", "-funwind-tables", "-O2", "-Wall",
  "-isysroot", $Toolchain, "-isystem", "$Toolchain\include", "-I", $build, "-c")
Run "$Llvm\clang.exe" ($cflags + @("-o", "$build\core.o", "$ps4\src\core.c"))
Run "$Llvm\clang.exe" ($cflags + @("-o", "$build\main_ps4.o", "$ps4\src\main_ps4.c"))
Run "$Llvm\ld.lld.exe" @("-m", "elf_x86_64", "-pie", "--script", "$Toolchain\link.x", "--eh-frame-hdr",
  "-L$Toolchain\lib", "-lc", "-lkernel", "-lSceVideoOut", "-lScePad", "-lSceUserService", "-lSceSysmodule",
  "-lSceNet", "-lSceSsl", "-lSceHttp", "$Toolchain\lib\crt1.o", "$build\core.o", "$build\main_ps4.o",
  "-o", "$build\kokicat.elf")
Push-Location $stage
try {
  Run "$Toolchain\bin\windows\create-fself.exe" @("-in", "$build\kokicat.elf", "--out", "$build\kokicat.oelf",
    "--eboot", "eboot.bin", "--paid", "0x3800000000000011")

  # 4) datos del paquete
  Copy-Item "$Toolchain\samples\graphics\sce_sys\about\right.sprx" "sce_sys\about\"
  Copy-Item "$Toolchain\samples\graphics\sce_module\libc.prx", "$Toolchain\samples\graphics\sce_module\libSceFios2.prx" "sce_module\"
  $pkgtool = "$Toolchain\bin\windows\PkgTool.Core.exe"
  Run $pkgtool @("sfo_new", "sce_sys/param.sfo")
  $entries = @(
    @("APP_TYPE", "Integer", "4", "1"), @("APP_VER", "Utf8", "8", $Version), @("ATTRIBUTE", "Integer", "4", "0"),
    @("CATEGORY", "Utf8", "4", "gd"), @("CONTENT_ID", "Utf8", "48", $ContentId), @("DOWNLOAD_DATA_SIZE", "Integer", "4", "0"),
    @("SYSTEM_VER", "Integer", "4", "0"), @("TITLE", "Utf8", "128", "KokiCat"), @("TITLE_ID", "Utf8", "12", $TitleId),
    @("VERSION", "Utf8", "8", $Version))
  foreach ($e in $entries) { Run $pkgtool @("sfo_setentry", "sce_sys/param.sfo", $e[0], "--type", $e[1], "--maxsize", $e[2], "--value", $e[3]) }

  $files = "eboot.bin sce_sys/about/right.sprx sce_sys/param.sfo sce_sys/icon0.png sce_module/libc.prx sce_module/libSceFios2.prx assets/koki.rgba assets/logo.rgba assets/coin.rgba"
  Run "$Toolchain\bin\windows\create-gp4.exe" @("-out", "pkg.gp4", "--content-id=$ContentId", "--files", $files)
  Run $pkgtool @("pkg_build", "pkg.gp4", $out)
} finally { Pop-Location }

$pkg = Join-Path $out "$ContentId.pkg"
$final = Join-Path $out "KokiCat-PS4-v$Version.pkg"
Move-Item -Force $pkg $final
Write-Host "Listo: $final ($([math]::Round((Get-Item $final).Length / 1MB, 1)) MB)"
