@echo off
:: Windows batch file that launches silently using VBS
if exist stealth-launcher.vbs (
    wscript.exe stealth-launcher.vbs
) else (
    echo Error: stealth-launcher.vbs not found!
    pause
)