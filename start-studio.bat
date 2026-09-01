@echo off
cd /d "%~dp0studio"

REM Guard on node_modules\.bin\next.cmd, NOT on the node_modules directory itself.
REM A directory that exists but is broken (e.g. .bin wiped out) slips past a presence
REM check, and the next npx call then falls through to PATH and reports something two
REM steps away from the real cause -- that is how a missing .bin surfaced as
REM "'playwright' is not recognized as an internal or external command".
REM next.cmd is what dev/build actually invoke, so it is the right sentinel.
REM NOTE: this checks a single file, so a partial break that keeps next.cmd is not caught.
if not exist "node_modules\.bin\next.cmd" (
  echo [DX Training Studio] Dependencies are missing or broken. Reinstalling with npm ci...
  call npm ci
  if errorlevel 1 (
    echo [DX Training Studio] npm ci failed. package-lock.json may be out of sync with package.json.
    echo [DX Training Studio] Falling back to npm install...
    call npm install
    if errorlevel 1 (
      echo.
      echo [DX Training Studio] Failed to install dependencies. Startup aborted.
      echo   1. Check Node.js:  node -v
      echo   2. Check your network connection
      echo   3. Then run  npm ci  in dx-training-studio\studio
      pause
      exit /b 1
    )
  )
)

echo [DX Training Studio] Building...
call npm run build
if errorlevel 1 (
  echo Build failed. The server was not started.
  pause
  exit /b 1
)

REM Open the browser only once the server actually answers. Opening it first (the old
REM order) races the server start: an API request that lands before the server is
REM listening comes back empty, and a caller that treats an empty result as "nothing
REM to show" then stays blank -- this is how the image pane came up empty at startup.
REM /b keeps the waiter in this console so its timeout message stays visible.
start /b "" powershell -NoProfile -Command "$u='http://localhost:3001/'; Write-Host '[DX Training Studio] Waiting for the server to answer...'; $deadline=(Get-Date).AddSeconds(60); while ((Get-Date) -lt $deadline) { try { if ((Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { Start-Process $u; exit } } catch { } Start-Sleep -Milliseconds 500 }; Write-Host '[DX Training Studio] The server did not answer within 60s. Open http://localhost:3001 manually once it is ready.'"
npm run start
