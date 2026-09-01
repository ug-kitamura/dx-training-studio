@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0mandala"

REM ============================================================================
REM Preview the published site the way it will look AT ITS DEPLOY TARGET.
REM This is NOT an app launcher, so it is deliberately not named start-*.
REM (spec project-layout: the deploy preview script requirement)
REM
REM What it does: build with the given basePath -> expand out\ into a temp folder
REM that mirrors the basePath as directories -> serve it -> open the browser once
REM the server answers.
REM
REM WHY A SERVER IS REQUIRED: opening index.html via file:// cannot work. Three
REM reasons: (1) absolute paths resolve against the drive root, (2) trailingSlash
REM makes links directory URLs and file:// does not fall back to index.html,
REM (3) fetch() is blocked on an opaque origin, killing search (_pagefind) and
REM Next client-side navigation. Reason (3) CANNOT be fixed by any basePath, so
REM there is no build configuration that makes file:// work.
REM
REM ALWAYS REBUILD WHEN THE TARGET CHANGES. basePath is baked into 600+ files as
REM absolute paths, so copying an existing out\ to a different target does NOT work.
REM
REM NOTE: local public\_pagefind accumulates fragments from previous builds
REM (measured: 326 locally vs 50 in CI). Harmless, but out\ is then not byte-for-byte
REM what CI publishes. Delete mandala\public\_pagefind first if that matters.
REM
REM THIS FILE MUST STAY PURE ASCII WITH CRLF LINE ENDINGS (like the other four
REM scripts). cmd reads batch files in the system ANSI codepage, so UTF-8 Japanese
REM comments are mangled -- comment lines then execute as commands and set lines
REM break. This was hit for real: PREVIEW_PORT came out empty and serve failed.
REM ============================================================================

set "PREVIEW_PORT=3003"
set "PREVIEW_ROOT=%TEMP%\dx-training-mandala-preview"

REM --- Resolve basePath -------------------------------------------------------
REM Can be passed directly:  preview-mandala-deploy.bat /dx-training-studio
REM
REM These values are also defined in the workflows (duplication is accepted):
REM   Intranet     : keep in sync with INTRANET_BASE_PATH in
REM                  .github/workflows/dx-training-mandala-release-intranet.yml
REM   GitHub Pages : the workflow derives it from the repository name
REM                  (/${{ github.event.repository.name }}), so the default below
REM                  should match the current repository name.
set "BASE_PATH=%~1"

if not "%BASE_PATH%"=="" goto :base_path_ready

echo.
echo [Preview] Which deploy target do you want to check?
echo   1. Intranet hosting   /doku/ccdx/dx-training-mandala
echo   2. GitHub Pages       /dx-training-studio
echo   3. No basePath        (Vercel / local equivalent, served at the root)
echo.
set "PREVIEW_CHOICE="
set /p "PREVIEW_CHOICE=Enter a number [default: 1]: "
if "%PREVIEW_CHOICE%"=="" set "PREVIEW_CHOICE=1"

if "%PREVIEW_CHOICE%"=="1" set "BASE_PATH=/doku/ccdx/dx-training-mandala"
if "%PREVIEW_CHOICE%"=="2" set "BASE_PATH=/dx-training-studio"
if "%PREVIEW_CHOICE%"=="3" goto :base_path_ready

if "%BASE_PATH%"=="" (
  echo.
  echo [Preview] Please enter 1, 2 or 3. Aborted.
  pause
  exit /b 1
)

:base_path_ready

REM basePath must not end with a slash -- Next rejects it.
if not "%BASE_PATH%"=="" (
  if "%BASE_PATH:~-1%"=="/" set "BASE_PATH=%BASE_PATH:~0,-1%"
)

if "%BASE_PATH%"=="" (
  echo [Preview] No basePath. The site will be served at the root.
) else (
  echo [Preview] basePath = %BASE_PATH%
)

REM --- Dependency sentinel ----------------------------------------------------
REM Guard on node_modules\.bin\next.cmd, NOT on the node_modules directory itself
REM (same rule as the four start-* scripts). A directory that exists but is broken
REM slips past a presence check and fails later with an unrelated error.
if not exist "node_modules\.bin\next.cmd" (
  echo [Preview] Dependencies are missing or broken. Reinstalling with npm ci...
  call npm ci
  if errorlevel 1 (
    echo [Preview] npm ci failed. Falling back to npm install...
    call npm install
    if errorlevel 1 (
      echo.
      echo [Preview] Failed to install dependencies. Aborted.
      echo   1. Check Node.js:  node -v
      echo   2. Check your network connection
      echo   3. Then run  npm ci  in dx-training-studio\mandala
      pause
      exit /b 1
    )
  )
)

REM --- Warn about a running mandala server ------------------------------------
REM A running dev/prod server holds the same .next, so the build can fail with
REM "A next build still in progress" and leave the OLD out\ in place. Serving that
REM would look like a successful check -- warn early. The build failure itself is
REM caught by the errorlevel check below.
powershell -NoProfile -Command "try { exit ([int]-not((Invoke-WebRequest -Uri 'http://localhost:3002/' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200)) } catch { exit 1 }"
if not errorlevel 1 (
  echo.
  echo [Preview] WARNING: port 3002 is answering, so a mandala server is running.
  echo   It holds the same .next, which can make the build fail with a lock error.
  echo   If the build fails, stop the server on 3002 and run this again.
  echo.
)

REM --- Build ------------------------------------------------------------------
REM Setting the variable here in cmd is part of the point: in Git Bash,
REM NEXT_PUBLIC_BASE_PATH=/doku/... is rewritten by MSYS path conversion into
REM C:/Program Files/Git/doku/... and the build breaks. Going through cmd avoids it.
echo [Preview] Building (this also generates the search index)...
set "NEXT_PUBLIC_BASE_PATH=%BASE_PATH%"
call npm run build
if errorlevel 1 (
  echo.
  echo [Preview] Build failed. Nothing was served.
  echo   Stopping here on purpose: serving a stale out\ would look like a
  echo   successful check of the new settings.
  pause
  exit /b 1
)

REM --- Expand into the temp folder --------------------------------------------
REM Wipe every run. Leftovers from a previous, different basePath sit side by side
REM and make it impossible to tell which site you are looking at.
if exist "%PREVIEW_ROOT%" rmdir /s /q "%PREVIEW_ROOT%"

REM Mirror basePath as directories and put out\ at the leaf.
REM The SERVE ROOT is always %PREVIEW_ROOT% (the top). Serving the site directory
REM itself doubles the path and gives 404s.
set "SITE_DEST=%PREVIEW_ROOT%"
if not "%BASE_PATH%"=="" (
  set "BASE_PATH_WIN=%BASE_PATH:/=\%"
  set "SITE_DEST=%PREVIEW_ROOT%!BASE_PATH_WIN!"
)

echo [Preview] Deploying to !SITE_DEST! ...
mkdir "!SITE_DEST!" 2>nul
xcopy "out" "!SITE_DEST!" /E /I /Q /Y >nul
if errorlevel 1 (
  echo [Preview] Failed to copy out\ into the preview folder. Aborted.
  pause
  exit /b 1
)

set "PREVIEW_URL=http://localhost:%PREVIEW_PORT%%BASE_PATH%/"

echo.
echo [Preview] Serve root : %PREVIEW_ROOT%
echo [Preview] URL        : %PREVIEW_URL%
echo.
echo   NOTE: the root URL (http://localhost:%PREVIEW_PORT%/) returns 404 or a
echo   directory listing. That is correct -- everything lives under the basePath.
echo.

REM --- Serve and open the browser ---------------------------------------------
REM Same rule as the four start-* scripts: open the browser only once the server
REM answers. On timeout, print the URL instead of opening it, and keep serving.
start /b "" powershell -NoProfile -Command "$u='%PREVIEW_URL%'; Write-Host '[Preview] Waiting for the server to answer...'; $deadline=(Get-Date).AddSeconds(60); while ((Get-Date) -lt $deadline) { try { if ((Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { Start-Process $u; exit } } catch { } Start-Sleep -Milliseconds 500 }; Write-Host '[Preview] The server did not answer within 60s. Open it manually once it is ready.'"

npx -y serve "%PREVIEW_ROOT%" -l %PREVIEW_PORT%
