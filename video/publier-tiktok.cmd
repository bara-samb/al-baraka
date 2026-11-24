@echo off
rem Envoi automatique sur TikTok, lance par vous ou par le Planificateur de taches Windows
rem 2 clips par jour selon le calendrier out\calendrier-tiktok.csv
cd /d "%~dp0"
echo ===== %date% %time% >> out\publication-tiktok.log
"C:\Program Files\nodejs\node.exe" upload-tiktok.js --limit 2 >> out\publication-tiktok.log 2>&1
