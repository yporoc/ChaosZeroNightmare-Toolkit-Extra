@echo off
title ChaosZero Toolkit Build (PyInstaller)

echo ============================================
echo   ChaosZero Toolkit - PyInstaller Build (v2.0)
echo   NOTE: official v2.0 exe was built with
echo   Python 3.13; this script rebuilds an
echo   equivalent exe from the restored source.
echo ============================================
echo.

where pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] PyInstaller not found, installing...
    pip install pyinstaller
    echo.
)

echo [1/3] Cleaning old build...
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
if exist "ChaosZero-Toolkit.spec" del /q "ChaosZero-Toolkit.spec"
echo      Done.
echo.

echo [2/3] Building exe with PyInstaller...
pyinstaller --onefile --noconsole --name ChaosZero-Toolkit ^
  --add-data "rebuild_ko_to_zht.py;." ^
  --add-data "rebuild_bundle.py;." ^
  --add-data "unpack_data.py;." ^
  --add-data "embedded_bundle_patcher.py;." ^
  --add-data "embedded_javascript\bgani.js;embedded_javascript" ^
  --add-data "embedded_javascript\boot.js;embedded_javascript" ^
  --add-data "embedded_javascript\bootres.js;embedded_javascript" ^
  --add-data "embedded_javascript\cheat.js;embedded_javascript" ^
  --add-data "embedded_javascript\entry_util.js;embedded_javascript" ^
  --add-data "embedded_javascript\init.js;embedded_javascript" ^
  --add-data "embedded_javascript\pre_data.js;embedded_javascript" ^
  --add-data "embedded_javascript\publisher_base.js;embedded_javascript" ^
  --add-data "embedded_javascript\publisher_stove.js;embedded_javascript" ^
  --add-data "embedded_javascript\publisher_xcent.js;embedded_javascript" ^
  --add-data "embedded_javascript\resolution.js;embedded_javascript" ^
  --add-data "embedded_javascript\title.js;embedded_javascript" ^
  --add-data "embedded_javascript\title_popups.js;embedded_javascript" ^
  --add-data "embedded_javascript\ttfwork.js;embedded_javascript" ^
  --add-data "embedded_javascript\util.js;embedded_javascript" ^
  --add-data "embedded_javascript\work_dynamic_atlas.js;embedded_javascript" ^
  --add-data "embedded_javascript\work_font_atlas.js;embedded_javascript" ^
  --hidden-import=customtkinter ^
  --hidden-import=opencc ^
  --hidden-import=pefile ^
  --collect-all customtkinter ^
  --collect-all opencc ^
  chaoszero_toolkit_gui.py

if %errorlevel% neq 0 (
    echo.
    echo [X] Build FAILED!
    pause
    exit /b 1
)

echo.
echo [3/3] Copying TSV files to dist...
copy "text_ko_text.tsv" "dist\text_ko_text.tsv" >nul 2>&1

echo.
echo ============================================
echo   Build OK!
echo   Output: dist\ChaosZero-Toolkit.exe
echo           dist\text_ko_text.tsv
echo ============================================

explorer "dist"
pause
