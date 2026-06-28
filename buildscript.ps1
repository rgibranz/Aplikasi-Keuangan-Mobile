# Build release APK (Android). Run from project root:
#   powershell -ExecutionPolicy Bypass -File buildscript.txt
#
# Needs pnpm (gesture-handler is patched via pnpm patchedDependencies for the
# Windows 260-char path limit — pnpm install reapplies it). Do NOT switch to npm.

$ErrorActionPreference = "Stop"
fnm env --use-on-cd | Out-String | Invoke-Expression   # node via fnm in non-interactive shell

pnpm install                                           # applies the gesture-handler patch
pnpm expo prebuild -p android --clean                  # regenerate android/ (patch lives in node_modules, survives this)

Set-Location android
.\gradlew.bat assembleRelease
Set-Location ..

Write-Host "`nAPK: $(Resolve-Path android\app\build\outputs\apk\release\app-release.apk)"
