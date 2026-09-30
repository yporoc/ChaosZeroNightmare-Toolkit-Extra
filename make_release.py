#!/usr/bin/env python3
# ChaosZero Toolkit Extra
# Copyright (C) 2026 ChaosZero-Toolkit contributors
# GNU General Public License v3, see LICENSE.
"""一键构建并发布 GitHub Release。

build    PyInstaller 编译 exe，装配 dist/ChaosZeroNightmare-Toolkit-Extra-v<版本>.zip，
         并对产物做隐私扫描（命中即失败退出）。
publish  在已合并该版本的 main 上执行：打 vX.Y.Z tag、创建 GitHub Release 并上传资产。
         需要 GITHUB_TOKEN 环境变量（不要把 token 写进任何文件）；tag 经 git/origin 推送。

用法:
  python make_release.py build
  python make_release.py publish
"""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
EXE_NAME = 'ChaosZero-Toolkit'
ZIP_NAME = 'ChaosZeroNightmare-Toolkit-Extra-v{ver}.zip'
BUNDLE_FILES = ['LICENSE', 'text_ko_text.tsv', 'text_zht_text(纯繁转简).tsv']
RUNTIME_FILES = {'speed_config.example.txt': 'speed_config.txt'}

# 分发禁含内容（本机路径/凭据/个人标识），命中即中止
FORBIDDEN = [b'LEGION', b'lenovo', b'ghp_', b'C:/Users', b'C:\\Users', b'yipingoroc']

PYINSTALLER_ARGS = [
    '--onefile', '--noconsole', '--name', EXE_NAME,
    '--add-data', 'rebuild_ko_to_zht.py;.',
    '--add-data', 'rebuild_bundle.py;.',
    '--add-data', 'unpack_data.py;.',
    '--add-data', 'embedded_bundle_patcher.py;.',
    '--add-data', 'ssra_zhcn.py;.',
    '--add-data', 'embedded_javascript;embedded_javascript',
    '--hidden-import', 'customtkinter', '--collect-all', 'customtkinter',
    '--hidden-import', 'opencc', '--collect-all', 'opencc',
    '--hidden-import', 'pefile',
    '--hidden-import', 'zstandard',
    '--hidden-import', 'xxhash',
    'chaoszero_toolkit_gui.py',
]

RELEASE_NOTES = """卡俄斯梦境（Chaos Zero Nightmare）汉化与游戏内变速工具 —— 社区维护版（GPLv3）。

本 Release 同时提供**预编译工具**与**完整源码**。

## 本版新增
- **ssra 版繁转简一键汉化**：适配游戏新的 ssra 资源体系（`gameres/manifest.ssra` + `chunks/*.ssrc`）。GUI 新增「繁转简 (ssra)」按钮：提取官方繁中 `text/zht/text.db` → OpenCC 转简（与社区「纯繁转简」词表对齐）→ 重建数据并自动应用；原文件自动备份，可一键还原。
- **补丁后不再被要求重新下载资源**：应用时同步启动器补丁引擎的 manifest 身份记录（etag 内 XXH64/尺寸），补丁流程直接通过。
- **检测区更新**：状态面板改为显示 `manifest.ssra` / `lang_zht_b03_0.ssrc` / `manifest.ssra.etag` 三个目标文件是否找到；移除已失效的 data.pack / 繁中语言包 / 翻译 TSV 检测。
- 源码运行时可走命令行：`python ssra_zhcn.py <gameres目录> build|apply|restore|status`

## 下载
| 文件 | 说明 |
|---|---|
| `ChaosZeroNightmare-Toolkit-Extra-v{ver}.zip` | 预编译工具（解压即用，含 `LICENSE`） |
| `Source code (zip)` / `Source code (tar.gz)` | 本 tag 的完整源码（由 GitHub 现场生成） |

## 使用
1. 解压后运行 `ChaosZero-Toolkit.exe`
2. 定位游戏目录（`bin` 或其上层），检测区确认三个 ssra 文件均为 ✅
3. 点「繁转简 (ssra)」→ 确认 → 构建完成后选「是」应用
4. 启动游戏，patching 正常通过，游戏内显示简体中文；再次运行工具可还原官方繁中
"""


def app_version():
    src = open(os.path.join(HERE, 'chaoszero_toolkit_gui.py'), encoding='utf-8').read()
    return re.search(r'APP_VERSION = "([^"]+)"', src).group(1)


def _scan(data, what):
    hits = {w.decode(): data.count(w) for w in FORBIDDEN if data.count(w)}
    if hits:
        raise SystemExit('隐私扫描未通过 (%s): %s' % (what, hits))


def build():
    if shutil.which('pyinstaller') is None:
        raise SystemExit('未找到 pyinstaller，请先: pip install -r requirements.txt')
    ver = app_version()
    subprocess.run([sys.executable, '-m', 'PyInstaller'] + PYINSTALLER_ARGS,
                   cwd=HERE, check=True)
    exe = os.path.join(HERE, 'dist', EXE_NAME + '.exe')
    _scan(open(exe, 'rb').read(), EXE_NAME + '.exe')
    zpath = os.path.join(HERE, 'dist', ZIP_NAME.format(ver=ver))
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(exe, EXE_NAME + '.exe')
        for rel in BUNDLE_FILES:
            z.write(os.path.join(HERE, rel), rel)
        for src_name, arc in RUNTIME_FILES.items():
            z.write(os.path.join(HERE, src_name), arc)
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            _scan(z.read(info.filename), info.filename)
    print('构建完成: %s (%.1f MB)' % (zpath, os.path.getsize(zpath) / 1048576))
    return zpath


def _api(method, url, token, data=None, raw=False):
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + token,
                                          'Accept': 'application/vnd.github+json',
                                          'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        b = r.read()
    return b if raw else json.loads(b or b'{}')


def publish():
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        raise SystemExit('缺少 GITHUB_TOKEN 环境变量（不要把 token 写进文件）')
    ver = app_version()
    tag = 'v' + ver
    url = subprocess.run(['git', 'remote', 'get-url', 'origin'], cwd=HERE,
                         capture_output=True, text=True, check=True).stdout.strip()
    repo = re.sub(r'^(git@github.com:|https://github.com/)', '', url).removesuffix('.git')
    zpath = os.path.join(HERE, 'dist', ZIP_NAME.format(ver=ver))
    if not os.path.isfile(zpath):
        raise SystemExit('缺少资产 %s，请先执行 build' % zpath)

    subprocess.run(['git', 'tag', '-f', tag], cwd=HERE, check=True)
    subprocess.run(['git', 'push', '-f', 'origin', tag], cwd=HERE, check=True)

    rel = _api('POST', 'https://api.github.com/repos/%s/releases' % repo, token,
               json.dumps({'tag_name': tag, 'name': 'ChaosZeroNightmare-Toolkit-Extra v%s' % ver,
                           'body': RELEASE_NOTES.replace('{ver}', ver),
                           'target_commitish': 'main'}).encode())
    up = 'https://uploads.github.com/repos/%s/releases/%d/assets?name=%s' % (
        repo, rel['id'], os.path.basename(zpath))
    req = urllib.request.Request(up, data=open(zpath, 'rb').read(), method='POST',
                                 headers={'Authorization': 'Bearer ' + token,
                                          'Content-Type': 'application/zip'})
    asset = json.loads(urllib.request.urlopen(req).read())
    print('Release 已发布: %s' % rel['html_url'])
    print('资产: %s (%.1f MB)' % (asset['name'], asset['size'] / 1048576))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'build':
        build()
    elif cmd == 'publish':
        publish()
    else:
        print(__doc__)
