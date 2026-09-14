# -*- mode: python ; coding: utf-8 -*-
# v2.0 build layout: 17 game js files embedded under embedded_javascript/,
from PyInstaller.utils.hooks import collect_all

datas = [
    ('rebuild_ko_to_zht.py', '.'),
    ('rebuild_bundle.py', '.'),
    ('unpack_data.py', '.'),
    ('embedded_bundle_patcher.py', '.'),
    ('embedded_javascript\\bgani.js', 'embedded_javascript'),
    ('embedded_javascript\\boot.js', 'embedded_javascript'),
    ('embedded_javascript\\bootres.js', 'embedded_javascript'),
    ('embedded_javascript\\cheat.js', 'embedded_javascript'),
    ('embedded_javascript\\entry_util.js', 'embedded_javascript'),
    ('embedded_javascript\\init.js', 'embedded_javascript'),
    ('embedded_javascript\\pre_data.js', 'embedded_javascript'),
    ('embedded_javascript\\publisher_base.js', 'embedded_javascript'),
    ('embedded_javascript\\publisher_stove.js', 'embedded_javascript'),
    ('embedded_javascript\\publisher_xcent.js', 'embedded_javascript'),
    ('embedded_javascript\\resolution.js', 'embedded_javascript'),
    ('embedded_javascript\\title.js', 'embedded_javascript'),
    ('embedded_javascript\\title_popups.js', 'embedded_javascript'),
    ('embedded_javascript\\ttfwork.js', 'embedded_javascript'),
    ('embedded_javascript\\util.js', 'embedded_javascript'),
    ('embedded_javascript\\work_dynamic_atlas.js', 'embedded_javascript'),
    ('embedded_javascript\\work_font_atlas.js', 'embedded_javascript'),
]
binaries = []
hiddenimports = ['customtkinter', 'opencc', 'pefile']
tmp_ret = collect_all('customtkinter')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('opencc')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['chaoszero_toolkit_gui.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ChaosZero-Toolkit',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
