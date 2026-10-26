@echo off
rem Envoi quotidien sur YouTube, lancé chaque jour par le Planificateur de tâches Windows
rem (tâche « AL BARAKA - Publication YouTube »). Le journal est dans out\publication.log.
rem 5 envois par jour au plus : le quota gratuit de l'API est de 10 000 unités, un envoi en coûte 1 600.
rem Publication : deux vidéos par jour (12 h et 18 h), trois Shorts par jour (9 h, 15 h et 21 h).
cd /d "%~dp0"
echo ===== %date% %time% >> out\publication.log
"C:\Program Files\nodejs\node.exe" upload-youtube.js long --limit 2 --hours 12,18 >> out\publication.log 2>&1
"C:\Program Files\nodejs\node.exe" upload-youtube.js shorts --limit 3 --hours 9,15,21 >> out\publication.log 2>&1
