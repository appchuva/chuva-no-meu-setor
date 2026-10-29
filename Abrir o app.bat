@echo off
chcp 65001 >nul
title Chuva no meu setor
cd /d "%~dp0"
echo.
echo   Chuva no meu setor
echo   ------------------
echo   O app vai abrir no navegador em http://localhost:8080
echo.
echo   DEIXE ESTA JANELA ABERTA enquanto usa o app.
echo   Para encerrar, feche esta janela.
echo.
start "" "http://localhost:8080"
where python >nul 2>nul
if %errorlevel%==0 (
  python servidor.py
) else (
  py servidor.py
)
echo.
echo   Nao consegui ligar o servidor. Verifique se o Python esta instalado.
pause
