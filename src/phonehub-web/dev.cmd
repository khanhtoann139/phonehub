@echo off
rem Khởi động Vite dev server. Nếu máy chưa cài Node.js, dùng bản Node đi kèm Visual Studio.
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>nul
if not errorlevel 1 goto run

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -prerelease -property installationPath`) do set "VSDIR=%%i"
)
if defined VSDIR if exist "%VSDIR%\MSBuild\Microsoft\VisualStudio\NodeJs\npm.cmd" set "PATH=%VSDIR%\MSBuild\Microsoft\VisualStudio\NodeJs;%PATH%"

where npm >nul 2>nul
if errorlevel 1 (
  echo [PhoneHub] Khong tim thay Node.js. Hay cai Node.js LTS tu https://nodejs.org roi chay lai.
  pause
  exit /b 1
)

:run
if not exist node_modules (
  echo [PhoneHub] Dang cai thu vien lan dau ^(npm install^)...
  call npm install --no-audit --no-fund || exit /b 1
)
call npm run dev
