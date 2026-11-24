@echo off
chcp 65001 >nul
title AL BARAKA - Connexion TikTok
cd /d "C:\Users\PC\Desktop\AL BARAKA\video"
echo =================================================================
echo        AL BARAKA - CONNEXION AUTOMATIQUE A TIKTOK STUDIO
echo =================================================================
echo.
"C:\Program Files\nodejs\node.exe" upload-tiktok.js setup
pause
