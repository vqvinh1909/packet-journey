@echo off
chcp 65001 >nul
rem Bam dup de mo app. Chay duoc o moi thu muc, chi can Python 3.
rem Khong mo thang index.html duoc vi trinh duyet chan ES modules tren file://.
cd /d "%~dp0"

rem "python" tren Windows co the la loi tat toi Microsoft Store, nen phai thu chay that.
set "PY=python"
%PY% --version >nul 2>nul || set "PY=py"
%PY% --version >nul 2>nul || (
  echo Chua co Python. Cai Python 3 tu https://www.python.org/downloads/ roi bam dup lai file nay.
  pause
  exit /b 1
)

if exist "..\serve.py" (
  rem May co giao trinh: serve.py o thu muc cha phuc vu ca app lan giao trinh.
  for %%I in ("%CD%") do set "URL=http://127.0.0.1:8008/%%~nxI/"
  start "Packet Journey server" cmd /k %PY% "..\serve.py" 8008
) else (
  set "URL=http://127.0.0.1:8008/"
  start "Packet Journey server" cmd /k %PY% -m http.server 8008 --bind 127.0.0.1
)
timeout /t 1 >nul
start "" "%URL%"
echo.
echo Neu trinh duyet chua mo app, dan URL nay vao:
echo %URL%
echo (Dong cua so server mau den de tat server.)
