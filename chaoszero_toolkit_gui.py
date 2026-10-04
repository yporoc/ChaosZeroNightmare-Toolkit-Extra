#!/usr/bin/env python3
# ChaosZero Toolkit Extra
# Copyright (C) 2026 ChaosZero-Toolkit contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""
ChaosZero Toolkit — 卡厄斯梦境 汉化 · 变速工具
现代卡片式 GUI（CustomTkinter）。功能：ssra 繁转简 / 加速 EXE 生成 / 游戏目录定位。
"""
import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import sys
import threading
import time
import string
import hashlib
import traceback
import glob
import json
import stat
import ctypes
import subprocess

# ═══════════════════════════════════════════════════════════════════════
# 主题配置
# ═══════════════════════════════════════════════════════════════════════
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# 颜色常量 — 精致深灰主题 (类 VS Code / Catppuccin)
COLOR_BG           = "#1E1E2E"       # 主背景 (深渊灰)
COLOR_BG_CARD      = "#27273A"       # 卡片背景 (稍亮的灰)
COLOR_ACCENT       = "#3B82F6"       # 强调色 (现代蓝)
COLOR_ACCENT_HOVER = "#2563EB"       # 强调色悬停
COLOR_HIGHLIGHT    = "#EF4444"       # 高亮/危险操作 (红)
COLOR_SUCCESS      = "#10B981"       # 成功 (绿)
COLOR_WARNING      = "#F59E0B"       # 警告 (橙/黄)
COLOR_WARN_DEEP    = "#B45309"       # 警告按钮底色 (深琥珀，白字可读)
COLOR_WARN_HOVER   = "#92400E"       # 警告按钮悬停
COLOR_TEXT         = "#F8FAFC"       # 主标题/文本 (亮白)
COLOR_TEXT_DIM     = "#94A3B8"       # 次要说明文本 (灰白)
COLOR_BORDER       = "#383854"       # 分隔线/边框
COLOR_LOG_BG       = "#11111B"       # 日志终端背景 (极暗)
COLOR_TITLE_BG     = "#11111B"       # 顶部标题栏背景

GLOBAL_FONT = ("Microsoft YaHei UI", "Segoe UI")

GAME_EXE_NAME     = "ssr-stove-shield.exe"
GAME_FOLDER_NAME  = "ChaosZeroNightmare"

# ---- 游戏目录定位相关常量 ----
GAME_ID_HINT   = "STOVE_CHAOSZERO"
# 唯一的硬判据：bin 下必须有本工具要补丁的那个 exe。其余都只用来定位候选。
GAME_ANCHOR_REL = os.path.join("bin", GAME_EXE_NAME)
# 目录名只是线索：STOVE 清单里写的是 ChaosZero，实机目录却是 ChaosZeroNightmare
GAME_ROOT_NAMES = [GAME_FOLDER_NAME, "ChaosZero"]
SGUP_APPS_SUB   = r"SOFTWARE\SGUP\apps"
SGUP_ACTIVE_SUB = r"SOFTWARE\SGUP\activeProcess"
UNINSTALL_SUB   = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
STOVE_MANIFEST_SUB = os.path.join("STOVE", "GameManifest")
COMBINED_MANIFEST_SUB = os.path.join("bin", "appdata", "cznlive")  # 数据分卷所在目录（多副本打分用）
# 扫盘预算：默认 5 层足够覆盖盘符下「任意父目录\游戏名」；勾选深度搜索放到 8
BFS_MAX_LEVELS  = 5
BFS_DEEP_LEVELS = 8
# AppData 是成本主项：实测不剪它比剪掉慢 40~110 倍，且游戏不可能装在那里
BFS_PRUNE_PREFIX = ("$", "#", "appdata", "windows", "programdata", "recovery",
                    "perflogs", "system volume", "onedrive", "node_modules",
                    ".git", "msocache", "$recycle")
# 出现这些字样更像是手工拷贝/下载残留，参与打分时降权（不作硬性排除）
COPY_HINT_TOKENS = ("desktop", "downloads", "onedrive", "appdata", "sandbox",
                    "副本", "备份", "copy", "-old", "_old", "backup", "\\bak")
SETTINGS_NAME = "toolkit_settings.json"

APP_VERSION = "2.0.4fix"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 打包后，exe 实际运行目录（而非临时解压目录）
# Nuitka: __nuitka_binary_dir 或 __compiled__；PyInstaller: sys.frozen
if "__compiled__" in dir() or hasattr(sys, 'frozen'):
    EXE_DIR = os.path.dirname(os.path.abspath(sys.argv[0]))
else:
    EXE_DIR = SCRIPT_DIR

# 兄弟模块（embedded_bundle_patcher / ssra_zhcn 等）是按目录名导入的，
# 启动期的目录检测就会用到，这里先把本目录挂上，免得依赖运行时的 import 顺序。
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)


def enable_windows_dpi_awareness():
    """高分屏清晰渲染：进程级 DPI 感知必须在首个窗口创建前声明。
    Win8.1+ 走 shcore（系统级感知，多屏缩放差异时由系统拉伸，布局最稳），
    失败再退 user32（Vista+），都不支持就算了。"""
    if os.name != "nt":
        return
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def is_windows_admin():
    """当前进程是否以管理员令牌运行（Win10/Win11 通用）。
    主路 shell32.IsUserAnAdmin；不可用时退回 GetTokenInformation(TokenElevation)。
    非 Windows 视为已提权，不影响源码自测。"""
    if os.name != "nt":
        return True
    try:
        if ctypes.windll.shell32.IsUserAnAdmin():
            return True
    except Exception:
        pass
    try:
        token = ctypes.c_void_p()
        if not ctypes.windll.advapi32.OpenProcessToken(
                ctypes.windll.kernel32.GetCurrentProcess(), 0x0008, ctypes.byref(token)):
            return False
        try:
            elev = ctypes.c_ulong()
            ret = ctypes.c_ulong()
            # 20 = TOKEN_ELEVATION：非零即提权令牌
            ok = ctypes.windll.advapi32.GetTokenInformation(
                token, 20, ctypes.byref(elev), ctypes.sizeof(elev), ctypes.byref(ret))
            return bool(ok and elev.value)
        finally:
            ctypes.windll.kernel32.CloseHandle(token)
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════
# 游戏目录定位 —— 只用标准库、不碰 GUI，可自测：python chaoszero_toolkit_gui.py --locate-selftest
#
# 顺序即优先级：先问「写下这条路径的人」（工具同级 / 注册表 / STOVE 清单），最后才扫盘。
# 不能找到第一个就收工：一台机器可能有多份体积分卷都相同的完整副本，首个命中往往是
# 桌面上的旧拷贝，补丁会打到不玩的那份 —— 所以先收齐候选再打分（score_candidate）。
# ═══════════════════════════════════════════════════════════════════════

def has_bin_exe(bin_path):
    """bin 目录里有没有本工具要补丁的 exe —— 唯一的硬判据。"""
    return bool(bin_path) and os.path.isfile(os.path.join(bin_path, GAME_EXE_NAME))


def has_anchor(root):
    """游戏根目录下有没有 bin\\<exe>。"""
    return has_bin_exe(os.path.join(root, "bin")) if root else False


def normalize_game_path(raw):
    """任意写法收敛成游戏根目录，返回 (root, 修正说明)：注册表 / 手打 / askdirectory
    给的斜杠路径、引号、%VAR%、指到 bin、指到 exe 都在此一次收敛。"""
    notes = []
    if not raw:
        return "", notes
    text = str(raw).strip().strip('"').strip("'").strip()
    if not text:
        return "", notes
    if text != str(raw).strip():
        notes.append("去掉首尾空白/引号")
    text = os.path.expandvars(os.path.expanduser(text))
    if os.name == "nt":
        if "/" in text:
            text = text.replace("/", "\\")
            notes.append("正斜杠已转为反斜杠")
        if len(text) > 3:
            text = text.rstrip("\\")
    root = os.path.normpath(text)
    if root != text:
        notes.append("normpath 归一")
    if root.lower().endswith(".exe"):
        root = os.path.dirname(os.path.dirname(root))
        notes.append("由 exe 路径上跳两级取游戏根")
    elif os.path.basename(root).lower() == "bin":
        root = os.path.dirname(root)
        notes.append("由 bin 目录上跳一级取游戏根")
    return root, notes


def _add_name(names, candidate):
    """把注册表/清单里读到的目录名并入候选（只收真正像目录名的）。"""
    name = str(candidate or "").strip().strip('"').strip("'")
    if name and len(name) > 2 and not any(sep in name for sep in "\\/:*?\"<>|"):
        if name not in names:
            names.append(name)
    return names


def list_drives():
    """只取本地盘（固定+可移动）。不能用 os.path.exists("Z:\\") 裸判：
    离线映射盘能阻塞几十秒，光驱还可能弹「请插入磁盘」。"""
    wanted = {3, 2}
    out = []
    try:
        get_type = ctypes.windll.kernel32.GetDriveTypeW
    except (AttributeError, OSError):
        get_type = None
    for letter in string.ascii_uppercase:
        root = letter + ":\\"
        if get_type is None:
            if os.path.exists(root):
                out.append(root)
            continue
        try:
            if get_type(root) in wanted:
                out.append(root)
        except OSError:
            continue
    return out


def is_reparse_point(path):
    """目录联接 / 符号链接。os.walk 会跟进 junction，同一棵树因此被扫两遍。"""
    try:
        return bool(os.lstat(path).st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    except (OSError, AttributeError):
        return False


def read_registry_records(trace):
    """一次读齐注册表里的全部相关记录（毫秒级），任何一键缺失都不该抛异常。"""
    rec = {"apps": [], "uninstall": [], "launcher": []}
    if os.name != "nt":
        trace.append("注册表: 跳过（非 Windows）")
        return rec
    try:
        import winreg
    except ImportError:
        trace.append("注册表: winreg 不可用")
        return rec

    def _values(hive, sub, view=0):
        out = {}
        try:
            with winreg.OpenKey(hive, sub, 0, winreg.KEY_READ | view) as key:
                info = winreg.QueryInfoKey(key)
                out["__subkeys__"] = [winreg.EnumKey(key, i) for i in range(info[0])]
                for i in range(info[1]):
                    name, value, _type = winreg.EnumValue(key, i)
                    out[name] = value
        except OSError:
            pass
        return out

    # ① 官方安装器写的 GamePath。枚举 apps\* 而不是写死 game_id，换平台/换 ID 不至于全瞎
    app_keys = _values(winreg.HKEY_CURRENT_USER, SGUP_APPS_SUB).get("__subkeys__", [])
    for game_id in app_keys:
        vals = _values(winreg.HKEY_CURRENT_USER, SGUP_APPS_SUB + "\\" + game_id)
        if vals.get("GamePath"):
            rec["apps"].append((game_id, vals["GamePath"], str(vals.get("ExeName", ""))))
    if not rec["apps"]:
        trace.append("注册表: %s 下没有 GamePath（共 %d 个子键）" % (SGUP_APPS_SUB, len(app_keys)))

    vals = _values(winreg.HKEY_CURRENT_USER, SGUP_ACTIVE_SUB)
    if vals.get("WorkingDir"):
        rec["launcher"].append(str(vals["WorkingDir"]))

    # ② 卸载信息：InstallLocation 经常是空的，DisplayIcon 才是 loader 的绝对路径
    for hive, hlabel in ((winreg.HKEY_LOCAL_MACHINE, "HKLM"), (winreg.HKEY_CURRENT_USER, "HKCU")):
        for view, vlabel in ((winreg.KEY_WOW64_64KEY, ""), (winreg.KEY_WOW64_32KEY, " (32位视图)")):
            base = _values(hive, UNINSTALL_SUB, view)
            for sub in base.get("__subkeys__", []):
                low = sub.lower()
                if GAME_ID_HINT.lower() not in low and "stove" not in low:
                    continue
                vals = _values(hive, UNINSTALL_SUB + "\\" + sub, view)
                if not vals:
                    continue
                rec["uninstall"].append((hlabel + vlabel + "\\" + sub, vals))
                for key in ("UninstallString", "ModifyPath"):
                    exe = str(vals.get(key, "")).strip().strip('"')
                    if exe.lower().endswith(".exe"):
                        rec["launcher"].append(exe)
    if not rec["uninstall"]:
        trace.append("注册表: 卸载项里没有 STOVE/本作记录")
    return rec


def registry_candidates(rec, trace):
    """注册表能直接确认的游戏根目录（权威来源）。"""
    out = []
    for game_id, raw, exe_name in rec["apps"]:
        root, _notes = normalize_game_path(raw)
        if has_anchor(root):
            trace.append("注册表 SGUP\\apps\\%s → %s" % (game_id, root))
            out.append((root, "注册表GamePath(%s)" % game_id))
        else:
            trace.append("注册表 %s 的 GamePath=%s 下没有 %s" % (game_id, root or "(空)", GAME_ANCHOR_REL))
    for sub, vals in rec["uninstall"]:
        raw = str(vals.get("InstallLocation") or "").strip()
        if not raw:
            raw = str(vals.get("DisplayIcon", "")).rsplit(",", 1)[0].strip().strip('"')
        root, _notes = normalize_game_path(raw)
        if has_anchor(root):
            trace.append("注册表 卸载项 %s → %s" % (sub, root))
            out.append((root, "注册表卸载信息"))
    return out


def stove_manifest_info():
    """%LOCALAPPDATA%\\STOVE\\GameManifest\\<id>_<版本>.json：官方安装清单。
    给不出绝对路径，但给出默认目录名（可能与实机不同）、相对 exe 对与客户端已知版本号 ——
    版本号是判断「这份副本旧不旧」的尺子。"""
    base = os.path.join(os.environ.get("LOCALAPPDATA", ""), *STOVE_MANIFEST_SUB.split(os.sep))
    best = None
    for path in glob.glob(os.path.join(base, "*.json")):
        try:
            with open(path, encoding="utf-8", errors="replace") as stream:
                data = json.load(stream)
        except (OSError, ValueError):
            continue
        if not isinstance(data, dict):
            continue
        version = _as_int(data.get("version_no")) or 0
        if best is None or version >= best[0]:
            best = (version, data)
    if not best:
        return {}
    version, data = best
    return {"version_no": version,
            "root_folder": str(data.get("root_folder") or ""),
            "launcher_dir": base}


def _as_int(value):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def candidate_version(root):
    """<root>\\combinedata_manifest\\GameManifest_*.upf 里的 local_version（是 JSON）。
    只有被官方启动器装过的目录才有；手抄副本常没这目录、或版本停在拷贝那一刻 ——
    这就是区分真身与诱饵的判据。"""
    best = None
    for path in glob.glob(os.path.join(root or "", "combinedata_manifest", "*.upf")):
        try:
            with open(path, encoding="utf-8", errors="replace") as stream:
                data = json.load(stream)
        except (OSError, ValueError):
            continue
        version = _as_int(data.get("local_version")) if isinstance(data, dict) else None
        if version is not None and (best is None or version > best):
            best = version
    return best


def derived_game_roots(rec, trace):
    """STOVE 客户端自身位置往上找「游戏的邻居目录」，比盲扫整块盘精准得多。"""
    out = []
    for seed in rec.get("launcher", []):
        parent = os.path.dirname(normalize_game_path(seed)[0])
        for _level in range(4):
            if not parent:
                break
            for leaf in ("Games", os.path.join("SteamLibrary", "steamapps", "common"), "xboxgames"):
                cand = os.path.join(parent, leaf)
                if os.path.isdir(cand) and cand.lower() not in {x.lower() for x in out}:
                    out.append(cand)
            parent = os.path.dirname(parent)
    if out:
        trace.append("STOVE 派生的游戏目录候选: %s" % "; ".join(out))
    return out


def tool_side_candidates(names):
    """工具自己在哪，游戏大概率就在哪 —— README 明写「解压到游戏目录的同级」。"""
    out = []
    base = os.path.normpath(EXE_DIR)
    for _level in range(4):
        for name in names:
            for leaf in (name, os.path.join("Games", name)):
                cand = os.path.join(base, leaf)
                if has_anchor(cand):
                    out.append((normalize_game_path(cand)[0], "工具同级"))
        parent = os.path.dirname(base)
        if parent == base:
            break
        base = parent
    return out


def bfs_find(names, roots, levels=BFS_MAX_LEVELS, cancel=None, on_progress=None,
             source="有界探测"):
    """逐层广度优先找 `<候选名>\\bin\\<exe>`，返回 [(游戏根目录, 来源)]。
    按层收敛是 os.walk 给不了的：浅层先出（越浅越像正式安装）、同层跳过 junction
    免扫两遍、每层查一次取消就够及时。"""
    lowered = {str(n).lower() for n in names if n}
    hits = []
    frontier = [os.path.normpath(r) for r in roots]
    visited = {os.path.normcase(x) for x in frontier}
    for level in range(levels):
        nxt = []
        for folder in frontier:
            try:
                with os.scandir(folder) as it:
                    entries = list(it)
            except OSError:
                continue
            for entry in entries:
                if cancel is not None and cancel.is_set():
                    return hits, True
                try:
                    if not entry.is_dir(follow_symlinks=False):
                        continue
                except OSError:
                    continue
                name = entry.name.lower()
                if name in lowered and has_anchor(entry.path):
                    hits.append((entry.path, source))
                    continue
                if name.startswith(BFS_PRUNE_PREFIX) or is_reparse_point(entry.path):
                    continue
                key = os.path.normcase(entry.path)
                if key in visited:
                    continue
                visited.add(key)
                nxt.append(entry.path)
        if on_progress:
            on_progress(level + 1, len(nxt))
        frontier = nxt
        if not frontier:
            break
    return hits, False


def score_candidate(root, expected_version=None):
    """多副本时的排序键（升序，越前越可信）。"""
    local_version = candidate_version(root) or 0
    exe = os.path.join(root, GAME_ANCHOR_REL)
    try:
        mtime = int(os.stat(exe).st_mtime)
    except OSError:
        mtime = 0
    pack_dir = os.path.join(root, *COMBINED_MANIFEST_SUB.split(os.sep))
    try:
        volumes = len([f for f in os.listdir(pack_dir) if f.startswith("data.pack")])
    except OSError:
        volumes = 0
    lowered = os.path.normpath(root).lower().replace("/", "\\")
    penalties = sum(1 for token in COPY_HINT_TOKENS if token in lowered)
    return (0 if local_version else 1,        # 有官方就地清单者优先
            -local_version,                   # 版本新者优先
            -volumes,                         # 数据分卷多者优先
            -mtime,                           # exe 修改时间新者优先
            lowered.rstrip("\\").count("\\"),  # 路径浅者优先
            penalties)                        # 像手工拷贝的降权


def dedupe(pool):
    """按 normcase 去重（Games 与 games 会被当成两个候选；同一根也可能多路命中）。"""
    out = {}
    for root, source in pool:
        key = os.path.normcase(os.path.normpath(root))
        if key not in out:
            out[key] = (root, source)
    return list(out.values())


def locate_game_bin(levels=BFS_MAX_LEVELS, cancel=None, report=None, chosen=None,
                    on_progress=None):
    """定位游戏 bin 目录，返回 (bin 路径 或 "", 来源, 轨迹)。
    levels=2 只问不扫盘（启动期静默恢复用），5=「自动寻找」，8=勾了深度搜索。"""
    def say(msg, level="info"):
        if report:
            report(msg, level)

    trace = []
    started = time.perf_counter()
    rec = read_registry_records(trace)
    names = list(GAME_ROOT_NAMES)
    for _gid, raw, _exe in rec["apps"]:
        _add_name(names, os.path.basename(normalize_game_path(raw)[0]))
    manifest = stove_manifest_info()
    _add_name(names, manifest.get("root_folder"))
    expected = manifest.get("version_no")

    def finish(root, source):
        bin_path = os.path.join(root, "bin")
        elapsed = (time.perf_counter() - started) * 1000
        trace.append("耗时 %.1f ms → %s（%s）" % (elapsed, bin_path, source))
        if expected:
            local = candidate_version(root)
            if local and local < expected:
                trace.append("⚠ 该副本版本 %s，STOVE 客户端已知 %s —— 可能不是当前在玩的那份"
                             % (local, expected))
        return bin_path, source, trace

    # ① 工具自身位置：用户把它放在哪就是给哪打补丁（下面已按锚点筛过）
    tool_pool = dedupe(tool_side_candidates(names))
    if tool_pool:
        root, source = tool_pool[0]
        say("已按工具所在目录就近命中；若要改用启动器记录的那份，请手动「浏览」选择", "info")
        return finish(root, source)

    # ② 注册表（官方写下的路径）——命中即终局，不参与打分
    reg = registry_candidates(rec, trace)
    if reg:
        best = sorted(dedupe(reg), key=lambda x: score_candidate(x[0], expected))[0]
        return finish(best[0], best[1])

    # ③ 逐层有界扫盘：收齐全部候选再打分，避免「第一个恰好是旧副本」
    roots = list_drives() + derived_game_roots(rec, trace)
    found, _cancelled = bfs_find(names, roots, levels=levels, cancel=cancel,
                                 on_progress=on_progress,
                                 source="深度探测" if levels > BFS_MAX_LEVELS else "有界探测")
    pool = dedupe(found)
    if cancel is not None and cancel.is_set():
        trace.append("搜索已按用户要求中止")
        return "", "", trace
    if not pool:
        trace.append("所有途径都没能确认 %s" % GAME_ANCHOR_REL)
        return "", "", trace
    if len(pool) > 1:
        ranked = sorted(pool, key=lambda x: score_candidate(x[0], expected))
        trace.append("发现 %d 份完整副本: %s" % (len(ranked), "; ".join(r[0] for r in ranked)))
        if chosen:
            picked = chosen(ranked)
            if not picked:
                trace.append("用户在候选列表里取消了选择")
                return "", "", trace
            pool = [picked]
        else:
            pool = ranked
    return finish(*pool[0])


def settings_paths():
    """配置落点候选：与内嵌 JS 的 _pickWritableToolkitDir 同一条思路，
    工具自身目录优先，不可写再退到用户级目录。"""
    out = [EXE_DIR,
           os.path.join(os.environ.get("LOCALAPPDATA", ""), "ChaosZero-Toolkit"),
           os.path.join(os.environ.get("TEMP", "."), "ChaosZero-Toolkit")]
    return [p for p in out if p]


def load_settings():
    """读回上次的路径记忆。返回 (dict, 文件路径)。文件坏了就当没有。"""
    for folder in settings_paths():
        path = os.path.join(folder, SETTINGS_NAME)
        try:
            with open(path, encoding="utf-8") as stream:
                data = json.load(stream)
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            return data, path
    return {}, ""


def save_settings(payload):
    """单键小文件，逐个候选目录试「写 + 回读校验」；全失败只退化为会话记忆。"""
    for folder in settings_paths():
        path = os.path.join(folder, SETTINGS_NAME)
        try:
            os.makedirs(folder, exist_ok=True)
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as stream:
                json.dump(payload, stream, ensure_ascii=False, indent=1)
            os.replace(tmp, path)
            with open(path, encoding="utf-8") as stream:
                json.load(stream)
            return path
        except (OSError, ValueError):
            continue
    return ""


class ChaosZeroToolkit(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("ChaosZero Toolkit — 卡厄斯梦境 汉化 · 变速工具")
        self.geometry("960x740")
        self.minsize(860, 620)
        self.configure(fg_color=COLOR_BG)

        # State
        self.game_bin_path = ctk.StringVar(value="")
        self.gameres_dir = ""
        self.is_running = False
        self._stop_requested = False
        self._locate_cancel = threading.Event()
        self._locating = False
        self._path_applied = ""
        self._speed_source_sha256 = ""
        self._speed_source_was_patched = False
        self._can_ssra = False
        self._can_speed = False
        self._log_buf = []
        self._log_flush_scheduled = False

        self._build_ui()
        self._elevated = is_windows_admin()
        self._log_line("当前权限：%s" % ("管理员" if self._elevated
                                      else "普通用户（执行功能前会提醒提权）"),
                       "info" if self._elevated else "warn")
        self._restore_or_autolocate()

    # ═══════════════════════════════════════════════════════════════
    # UI 构建
    # ═══════════════════════════════════════════════════════════════
    def _build_ui(self):
        self._build_header()

        main_frame = ctk.CTkFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=20, pady=10)

        self._build_path_section(main_frame)
        self._build_status_section(main_frame)
        self._build_action_section(main_frame)
        self._build_progress_section(main_frame)
        self._build_log_section(main_frame)

    def _build_header(self):
        bar = ctk.CTkFrame(self, fg_color=COLOR_TITLE_BG, corner_radius=0, height=64)
        bar.pack(fill="x", padx=0, pady=0)
        bar.pack_propagate(False)

        ctk.CTkLabel(
            bar, text="⚔ ChaosZero Toolkit",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=21, weight="bold"),
            text_color="#FFFFFF"
        ).pack(side="left", padx=20, pady=15)
        ctk.CTkLabel(
            bar, text="v" + APP_VERSION,
            font=ctk.CTkFont(family="Consolas", size=12),
            text_color=COLOR_TEXT_DIM
        ).pack(side="left", padx=(0, 10), pady=15)

        # 提权状态常驻标题栏：未提权时芯片即按钮，点击直接申请管理员
        if is_windows_admin():
            ctk.CTkLabel(
                bar, text="✓ 管理员运行",
                font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
                text_color=COLOR_SUCCESS
            ).pack(side="right", padx=(4, 20), pady=15)
        else:
            ctk.CTkButton(
                bar, text="未以管理员运行 · 点击提权", width=210, height=30,
                corner_radius=8, fg_color=COLOR_WARN_DEEP, hover_color=COLOR_WARN_HOVER,
                text_color="#FFFFFF", border_width=1, border_color="#7C2D12",
                font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
                command=self._elevate_restart
            ).pack(side="right", padx=(4, 20), pady=15)

        qq_btn = ctk.CTkButton(
            bar, text="QQ群", width=72, height=30, corner_radius=8,
            fg_color="transparent", hover_color=COLOR_BG_CARD,
            text_color="#FFFFFF", border_width=1, border_color=COLOR_BORDER,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            command=lambda: self._copy_to_clipboard("777529227")
        )
        qq_btn.pack(side="right", padx=4, pady=15)

        github_btn = ctk.CTkButton(
            bar, text="GitHub", width=86, height=30, corner_radius=8,
            fg_color="transparent", hover_color=COLOR_BG_CARD,
            text_color="#FFFFFF", border_width=1, border_color=COLOR_BORDER,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            command=lambda: self._open_url("https://github.com/NineS11942/ChaosZeroYuna-Engine-Unpacker-Simplified-Chinese-Localization-Patch")
        )
        github_btn.pack(side="right", padx=4, pady=15)

    def _build_path_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLOR_BG_CARD, corner_radius=10,
                             border_width=1, border_color=COLOR_BORDER)
        frame.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(
            frame, text=" ① 游戏目录",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=15, weight="bold"),
            text_color=COLOR_TEXT, anchor="w"
        ).pack(fill="x", padx=15, pady=(12, 2))

        ctk.CTkLabel(
            frame,
            text="选择 ChaosZeroNightmare 文件夹（或直接输入路径后回车）；「自动寻找」先查官方安装记录与常见安装层，必要时才扫盘",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
            text_color=COLOR_TEXT_DIM, anchor="w"
        ).pack(fill="x", padx=18, pady=(0, 8))

        row = ctk.CTkFrame(frame, fg_color="transparent")
        row.pack(fill="x", padx=15, pady=(0, 15))

        self.path_entry = ctk.CTkEntry(
            row,
            textvariable=self.game_bin_path,
            placeholder_text=" 游戏路径 (可手动浏览或自动寻找)...",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            height=36,
            corner_radius=6,
            fg_color="#181825",
            text_color=COLOR_TEXT,
            border_width=1,
            border_color=COLOR_BORDER
        )
        # 手打路径也要生效：回车/失焦即校验并检测
        for seq in ("<Return>", "<KP_Enter>", "<FocusOut>"):
            self.path_entry.bind(seq, self._on_path_typed)

        self.auto_find_btn = ctk.CTkButton(
            row, text="自动寻找", width=100, height=36, corner_radius=6,
            fg_color=COLOR_SUCCESS, hover_color="#059669",
            text_color="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            command=self._auto_find_game
        )
        self.auto_find_btn.pack(side="right", padx=(0, 8))

        browse_btn = ctk.CTkButton(
            row, text="浏览", width=80, height=36, corner_radius=6,
            fg_color=COLOR_ACCENT, hover_color=COLOR_ACCENT_HOVER,
            text_color="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            command=self._browse_game_dir
        )
        browse_btn.pack(side="right")

        self.deep_scan_var = ctk.BooleanVar(value=False)
        self.deep_scan_cb = ctk.CTkCheckBox(
            row, text="深度搜索", variable=self.deep_scan_var,
            width=100, height=36,
            checkbox_width=16, checkbox_height=16, corner_radius=4,
            fg_color=COLOR_BG_CARD, border_color=COLOR_BORDER, border_width=1,
            text_color=COLOR_TEXT_DIM,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
            command=self._toggle_deep_tip
        )
        self.deep_scan_cb.pack(side="right", padx=(0, 6))
        # expand 的输入框必须最后 pack，否则窗口一窄就把右侧按钮挤出容器点不到
        self.path_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self._deep_tip_shown = False

    def _build_status_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLOR_BG_CARD, corner_radius=10,
                             border_width=1, border_color=COLOR_BORDER)
        frame.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(
            frame, text=" ② 就绪检测",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=15, weight="bold"),
            text_color=COLOR_TEXT, anchor="w"
        ).pack(fill="x", padx=15, pady=(12, 4))

        grid = ctk.CTkFrame(frame, fg_color="transparent")
        grid.pack(fill="x", padx=15, pady=(0, 15))
        grid.columnconfigure((0, 1, 2, 3, 4), weight=1)

        self.status_labels = {}
        indicators = [
            ("exe", "游戏启动器 EXE", "等待检测"),
            ("js", "内嵌脚本 ×17", "等待检测"),
            ("manifest", "manifest.ssra", "等待检测"),
            ("part", "lang_zht_b03_0.ssrc", "等待检测"),
            ("etag", "manifest.ssra.etag", "等待检测"),
        ]
        for col, (key, title, default) in enumerate(indicators):
            card = ctk.CTkFrame(grid, fg_color="#313244", corner_radius=6,
                                border_width=1, border_color="#45475A")
            card.grid(row=0, column=col, padx=4, pady=2, sticky="nsew")

            ctk.CTkLabel(card, text=title,
                         font=ctk.CTkFont(family=GLOBAL_FONT[0], size=11),
                         text_color=COLOR_TEXT_DIM).pack(pady=(10, 2))
            value = ctk.CTkLabel(card, text=default,
                                 font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12, weight="bold"),
                                 text_color=COLOR_TEXT)
            value.pack(pady=(0, 10))
            self.status_labels[key] = value

    def _build_action_section(self, parent):
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        wrap.pack(fill="x", pady=(0, 8))
        wrap.columnconfigure((0, 1), weight=1, uniform="action")

        zh_card = ctk.CTkFrame(wrap, fg_color=COLOR_BG_CARD, corner_radius=10,
                               border_width=1, border_color=COLOR_BORDER)
        zh_card.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        ctk.CTkLabel(
            zh_card, text="繁转简 · ssra",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=15, weight="bold"),
            text_color=COLOR_TEXT, anchor="w"
        ).pack(fill="x", padx=15, pady=(12, 2))
        ctk.CTkLabel(
            zh_card,
            text="提取官方繁中文本转简体并应用到游戏；原文件自动备份，可随时还原。应用后 patching 不再要求重新下载。",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
            text_color=COLOR_TEXT_DIM, anchor="w", justify="left", wraplength=390
        ).pack(fill="x", padx=18, pady=(0, 12))
        self.ssra_btn = ctk.CTkButton(
            zh_card, text="开始繁转简", height=40, corner_radius=8,
            fg_color=COLOR_ACCENT, hover_color=COLOR_ACCENT_HOVER,
            text_color="#FFFFFF", text_color_disabled="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=14, weight="bold"),
            command=self._start_ssra_zhcn, state="disabled"
        )
        self.ssra_btn.pack(fill="x", padx=15, pady=(0, 15))

        sp_card = ctk.CTkFrame(wrap, fg_color=COLOR_BG_CARD, corner_radius=10,
                               border_width=1, border_color=COLOR_BORDER)
        sp_card.grid(row=0, column=1, sticky="nsew", padx=(6, 0))
        ctk.CTkLabel(
            sp_card, text="加速 EXE",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=15, weight="bold"),
            text_color=COLOR_TEXT, anchor="w"
        ).pack(fill="x", padx=15, pady=(12, 2))
        ctk.CTkLabel(
            sp_card,
            text="补丁游戏 EXE 注入变速/热键脚本（自动适配游戏更新），产物输出到 output 目录，可选择自动替换（原文件备份为 .bak）。",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
            text_color=COLOR_TEXT_DIM, anchor="w", justify="left", wraplength=390
        ).pack(fill="x", padx=18, pady=(0, 12))
        self.speed_btn = ctk.CTkButton(
            sp_card, text="生成加速 EXE", height=40, corner_radius=8,
            fg_color=COLOR_ACCENT, hover_color=COLOR_ACCENT_HOVER,
            text_color="#FFFFFF", text_color_disabled="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=14, weight="bold"),
            command=self._start_speed_exe, state="disabled"
        )
        self.speed_btn.pack(fill="x", padx=15, pady=(0, 15))

    def _build_progress_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLOR_BG_CARD, corner_radius=10,
                             border_width=1, border_color=COLOR_BORDER)
        frame.pack(fill="x", pady=(0, 8))

        row = ctk.CTkFrame(frame, fg_color="transparent")
        row.pack(fill="x", padx=15, pady=(10, 2))

        self.progress_label = ctk.CTkLabel(
            row, text="进度：等待操作",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            text_color=COLOR_TEXT, anchor="w"
        )
        self.progress_label.pack(side="left")

        self.stop_btn = ctk.CTkButton(
            row, text="停止", width=84, height=26, corner_radius=6,
            fg_color="#313244", hover_color="#45475A",
            text_color=COLOR_TEXT, border_width=1, border_color=COLOR_BORDER,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12, weight="bold"),
            command=self._request_stop, state="disabled"
        )
        self.stop_btn.pack(side="right")

        self.progress_pct = ctk.CTkLabel(
            row, text="0%",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            text_color=COLOR_SUCCESS, anchor="e"
        )
        self.progress_pct.pack(side="right", padx=(0, 10))

        self.progress_bar = ctk.CTkProgressBar(
            frame, height=10, corner_radius=5,
            fg_color="#313244", progress_color=COLOR_SUCCESS
        )
        self.progress_bar.pack(fill="x", padx=15, pady=(2, 12))
        self.progress_bar.set(0)

    def _build_log_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLOR_BG_CARD, corner_radius=10,
                             border_width=1, border_color=COLOR_BORDER)
        frame.pack(fill="both", expand=True, pady=(0, 0))

        header_row = ctk.CTkFrame(frame, fg_color="transparent")
        header_row.pack(fill="x", padx=15, pady=(8, 4))

        ctk.CTkLabel(
            header_row, text=" 运行日志",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=14, weight="bold"),
            text_color=COLOR_TEXT, anchor="w"
        ).pack(side="left")

        clear_btn = ctk.CTkButton(
            header_row, text="清空", width=50, height=26, corner_radius=4,
            fg_color="#313244", text_color=COLOR_TEXT, hover_color="#45475A",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
            command=self._clear_log
        )
        clear_btn.pack(side="right")

        self.log_text = ctk.CTkTextbox(
            frame,
            font=ctk.CTkFont(family="Consolas", size=13),
            fg_color=COLOR_LOG_BG,
            text_color="#A6ACCD",
            corner_radius=6,
            border_width=1,
            border_color="#181825",
            wrap="word",
            state="disabled"
        )
        self.log_text.pack(fill="both", expand=True, padx=15, pady=(0, 15))

    # ═══════════════════════════════════════════════════════════════
    # 日志工具
    # ═══════════════════════════════════════════════════════════════
    def _log(self, text):
        """线程安全日志：先入缓冲，合帧后一次写入控件。
        长任务每秒可产生上百行，逐行 insert 会刷爆 UI 线程 —— 批量是硬要求。"""
        self._log_buf.append(text)
        if not self._log_flush_scheduled:
            self._log_flush_scheduled = True
            self.after(120, self._flush_log)

    def _flush_log(self):
        self._log_flush_scheduled = False
        if not self._log_buf:
            return
        chunk = "".join(self._log_buf)
        self._log_buf.clear()
        self.log_text.configure(state="normal")
        self.log_text.insert("end", chunk)
        # 行数上限：超限裁头部，防长时间运行内存与渲染膨胀
        lines = int(self.log_text.index("end-1c").split(".")[0])
        if lines > 6000:
            self.log_text.delete("1.0", "%d.0" % (lines - 5000))
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _log_line(self, msg, level="info"):
        ts = time.strftime("%H:%M:%S")
        prefix = {"info": "·", "ok": "✓", "warn": "⚠", "error": "✗", "step": "▶"}.get(level, "·")
        self._log(f"[{ts}] {prefix}  {msg}\n")

    def _clear_log(self):
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")

    def _copy_to_clipboard(self, text):
        self.clipboard_clear()
        self.clipboard_append(text)
        self._log_line(f"已复制: {text}", "ok")

    def _open_url(self, url):
        import webbrowser
        webbrowser.open(url)

    # ═══════════════════════════════════════════════════════════════
    # 进度更新
    # ═══════════════════════════════════════════════════════════════
    def _set_progress(self, value, text=""):
        def _update():
            self.progress_bar.set(value)
            self.progress_pct.configure(text=f"{int(value * 100)}%")
            if text:
                self.progress_label.configure(text=f"进度：{text}")
        self.after(0, _update)

    def _set_status(self, key, text, ok=None):
        def _update():
            label = self.status_labels.get(key)
            if label:
                label.configure(text=text)
                if ok is True:
                    label.configure(text_color=COLOR_SUCCESS)
                elif ok is False:
                    label.configure(text_color=COLOR_WARNING)
                else:
                    label.configure(text_color=COLOR_TEXT)
        self.after(0, _update)

    def _request_stop(self):
        self._stop_requested = True
        self._log_line("正在停止...", "warn")

    # ═══════════════════════════════════════════════════════════════
    # 管理员权限：检测在启动时完成（_elevated）；未提权时所有写入类
    # 功能执行前走一次醒目提醒，可当场一键提权重启
    # ═══════════════════════════════════════════════════════════════
    def _ensure_admin_or_confirm(self, action):
        """未提权时执行功能前的醒目提醒。
        返回 True 表示本次继续；False 表示取消（或已发起提权重启，本实例随即退出）。"""
        if self._elevated:
            return True
        box = ctk.CTkToplevel(self, fg_color=COLOR_BG_CARD)
        box.title("权限提醒")
        box.geometry("560x360")
        box.resizable(False, False)
        box.transient(self)
        choice = {"go": None}

        def finish(value):
            choice["go"] = value
            box.destroy()

        ctk.CTkLabel(box, text="⚠",
                     font=ctk.CTkFont(size=46),
                     text_color=COLOR_WARNING).pack(pady=(26, 2))
        ctk.CTkLabel(box, text="建议以管理员身份运行",
                     font=ctk.CTkFont(family=GLOBAL_FONT[0], size=19, weight="bold"),
                     text_color=COLOR_TEXT).pack()
        ctk.CTkLabel(
            box,
            text="即将执行：" + action + "\n\n"
                 "当前未以管理员身份运行。写入游戏目录、替换 EXE\n"
                 "或修改游戏资源时，可能因权限不足或文件占用而失败。\n"
                 "推荐以管理员身份重启工具后再执行。",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            text_color=COLOR_TEXT_DIM, justify="center"
        ).pack(pady=(10, 20), padx=30)

        btns = ctk.CTkFrame(box, fg_color="transparent")
        btns.pack(pady=(0, 22))
        ctk.CTkButton(
            btns, text="以管理员身份重启（推荐）", width=216, height=40, corner_radius=8,
            fg_color=COLOR_WARN_DEEP, hover_color=COLOR_WARN_HOVER, text_color="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            command=lambda: finish("elevate")
        ).pack(side="left", padx=6)
        ctk.CTkButton(
            btns, text="本次仍要继续", width=132, height=40, corner_radius=8,
            fg_color="#313244", hover_color="#45475A", text_color=COLOR_TEXT,
            border_width=1, border_color=COLOR_BORDER,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            command=lambda: finish(True)
        ).pack(side="left", padx=6)

        box.protocol("WM_DELETE_WINDOW", lambda: finish(None))
        box.grab_set()
        box.after(120, box.lift)
        box.wait_window()

        if choice["go"] == "elevate":
            self._elevate_restart()
            return False
        if choice["go"] is True:
            self._log_line("未提权继续执行（用户确认）：" + action, "warn")
            return True
        self._log_line("已取消操作（未提权）：" + action, "warn")
        return False

    def _elevate_restart(self):
        """以管理员身份重新启动本工具（触发 UAC），成功后退出当前实例。"""
        try:
            if getattr(sys, "frozen", False):
                exe = sys.executable
                params = subprocess.list2cmdline(sys.argv[1:])
            else:
                exe = sys.executable
                params = subprocess.list2cmdline([os.path.abspath(sys.argv[0])] + list(sys.argv[1:]))
            # lpDirectory 传工具目录：提权后实例的工作目录不变，配置与日志仍落在同一处
            rc = ctypes.windll.shell32.ShellExecuteW(None, "runas", exe, params, EXE_DIR, 1)
        except Exception as exc:
            self._log_line(f"提权重启失败: {exc}", "error")
            return False
        if int(rc & 0xFFFFFFFF) > 32:
            self._log_line("已请求管理员授权，正在以管理员身份重启…（本窗口可关闭）", "ok")
            self.after(400, self.destroy)
            return True
        self._log_line("未获得管理员授权（UAC 已取消或被策略阻止）", "warn")
        return False

    # ═══════════════════════════════════════════════════════════════
    # 自动寻找游戏目录
    # ═══════════════════════════════════════════════════════════════
    def _auto_find_game(self):
        """按「权威来源 → 有界探测 → 剪枝扫盘」的顺序定位游戏目录；搜索中再点一次即停止。"""
        if self._locating:
            self._locate_cancel.set()
            self._log_line("正在停止搜索（当前层结束后返回）...", "warn")
            return
        deep = bool(self.deep_scan_var.get())
        self._locate_cancel.clear()
        self._locating = True
        self.auto_find_btn.configure(text="停止搜索", fg_color=COLOR_HIGHLIGHT,
                                     hover_color="#B91C1C")
        self._log_line("开始自动寻找游戏目录（%s）..." % ("深度搜索" if deep else "常规探测"), "step")
        threading.Thread(target=self._auto_find_worker,
                         args=(BFS_DEEP_LEVELS if deep else BFS_MAX_LEVELS,), daemon=True).start()

    def _reset_auto_find_btn(self):
        self._locating = False
        self.auto_find_btn.configure(state="normal", text="自动寻找",
                                     fg_color=COLOR_SUCCESS, hover_color="#059669")

    def _toggle_deep_tip(self):
        """第一次勾深度搜索时说明代价，避免用户以为勾上就更准。"""
        if self.deep_scan_var.get() and not self._deep_tip_shown:
            self._deep_tip_shown = True
            self._log_line("深度搜索会扫到第 %d 层（更慢，只在常规探测落空时才需要）；"
                           "多数情况下「官方安装记录 + 常见安装层」就已经是对的" % BFS_DEEP_LEVELS, "info")

    def _auto_find_worker(self, levels):
        """后台线程：只定位与打日志，一切界面改动回主线程执行。"""
        found, source, trace = "", "", []
        shown_layer = [0]

        def on_progress(level, pending):
            if level != shown_layer[0]:
                shown_layer[0] = level
                self._log_line(f"  已扫完第 {level} 层，下一层待查 {pending} 个目录", "info")

        try:
            found, source, trace = locate_game_bin(
                levels=levels, cancel=self._locate_cancel,
                report=lambda msg, level="info": self._log_line(msg, level),
                on_progress=on_progress,
                chosen=self._choose_candidate)
        except Exception as e:
            self._log_line(f"自动寻找出错: {e}", "error")
            for line in traceback.format_exc().splitlines():
                self._log_line("    " + line, "error")
        finally:
            self.after(0, self._reset_auto_find_btn)

        for line in trace:
            self._log_line("  · " + line, "warn" if line.startswith("⚠") else "info")
        if found:
            self._log_line(f"自动定位成功: {found}", "ok")
            self.after(0, lambda: self._apply_found_path(found, source))
            return
        if self._locate_cancel.is_set():
            self._log_line("搜索已停止", "warn")
            return
        self._log_line("未能定位游戏目录，请用「浏览」手动选择", "error")
        self.after(0, lambda: messagebox.showwarning(
            "未找到游戏",
            f"查过官方安装记录、STOVE 清单与 {levels} 层磁盘扫描，都没能确认这个文件：\n\n"
            f"  {GAME_FOLDER_NAME}\\{GAME_ANCHOR_REL}\n\n"
            "请确认游戏已安装完整，或用「浏览」手动选择（选包含 bin 的那一层）。\n"
            "也可以勾选「深度搜索」后重试。"))

    def _choose_candidate(self, ranked):
        """多份可信度相同的副本时让用户点名。在后台线程里被调用，回主线程弹窗并等结果。"""
        result = {"pick": None}
        done = threading.Event()
        self.after(0, lambda: self._ask_candidate(ranked, result, done))
        if not done.wait(300):
            return ranked[0]          # 用户没理会就别卡住搜索
        return result["pick"]

    def _ask_candidate(self, ranked, result, done):
        box = ctk.CTkToplevel(self)
        box.title("选择要处理的游戏目录")
        box.geometry("640x320")
        box.transient(self)
        chosen = ctk.StringVar(value=ranked[0][0])
        ctk.CTkLabel(
            box, text="发现多份都完整的游戏目录，请选择要汉化/加速的那一份：",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13), text_color=COLOR_TEXT
        ).pack(padx=16, pady=(14, 6), anchor="w")
        for root, source in ranked[:8]:
            version = candidate_version(root)
            ctk.CTkRadioButton(
                box, text="%s   （%s，就地版本 %s）" % (root, source, version if version else "无清单"),
                variable=chosen, value=root,
                font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12), text_color=COLOR_TEXT_DIM
            ).pack(padx=20, pady=3, anchor="w")

        def settle(value):
            result["pick"] = value
            done.set()
            box.destroy()

        box.protocol("WM_DELETE_WINDOW", lambda: settle(None))

        ctk.CTkLabel(
            box, text="判据：就地清单版本号 > 分卷数 > exe 修改时间 > 路径深度；默认已选中最可信的一份",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=11), text_color=COLOR_TEXT_DIM
        ).pack(padx=16, pady=(10, 4), anchor="w")
        row = ctk.CTkFrame(box, fg_color="transparent")
        row.pack(pady=10)
        ctk.CTkButton(row, text="就用这个", width=110, command=lambda: settle(chosen.get())).pack(side="left", padx=6)
        ctk.CTkButton(row, text="取消", width=90, fg_color="#313244",
                      command=lambda: settle(None)).pack(side="left", padx=6)
        box.grab_set()
        box.after(120, box.lift)

    def _apply_found_path(self, bin_path, source=""):
        """应用游戏 bin 目录并记住它 —— 下次启动直接恢复，不必再探测。"""
        self.game_bin_path.set(bin_path)
        self._path_applied = str(bin_path).strip()
        save_settings({"game_bin_path": bin_path,
                       "source": source or "手动",
                       "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S")})
        self._detect_game_files(bin_path)

    def _restore_or_autolocate(self):
        """启动流程：路径记忆仍有效就零扫描恢复；否则只跑毫秒级的权威层。"""
        saved, settings_file = load_settings()
        bin_path = normalize_game_path(saved.get("game_bin_path", ""))[0]
        if bin_path and has_bin_exe(bin_path):
            self._log_line("已恢复上次使用的游戏目录（来源：%s，配置在 %s）"
                           % (saved.get("source", "记忆"), os.path.dirname(settings_file)), "info")
            self.game_bin_path.set(bin_path)
            self._path_applied = bin_path
            self._detect_game_files(bin_path)
            return
        if bin_path:
            self._log_line("上次的游戏目录已不可用，重新定位: %s" % bin_path, "warn")
        found, source, trace = locate_game_bin(levels=2)
        if found and has_bin_exe(found):
            self._log_line("已自动定位游戏目录: %s（%s）" % (found, source), "ok")
            self._apply_found_path(found, source)
            return
        self._log_line("未找到游戏目录 —— 点「自动寻找」做完整探测，或直接输入路径/用「浏览」选择", "warn")

    # ═══════════════════════════════════════════════════════════════
    # 路径选择 & 检测
    # ═══════════════════════════════════════════════════════════════
    def _browse_game_dir(self):
        path = filedialog.askdirectory(
            title="选择 ChaosZeroNightmare 文件夹或 bin 目录",
            initialdir=self.game_bin_path.get() or os.path.expanduser("~")
        )
        if path:
            bin_path, notes = self._resolve_game_path(path)
            for note in notes:
                self._log_line("路径已修正: %s" % note, "info")
            self._apply_found_path(bin_path, "手动浏览")

    def _on_path_typed(self, _event=None):
        """手打路径也要认：回车或失焦即归一化 + 校验 + 检测。"""
        raw = self.game_bin_path.get().strip()
        if not raw or os.path.normcase(raw) == os.path.normcase(self._path_applied):
            return
        bin_path, notes = self._resolve_game_path(raw)
        if not has_bin_exe(bin_path):
            self._log_line("该路径下没有 %s，暂不启用构建: %s"
                           % (GAME_ANCHOR_REL, "; ".join(notes) or raw), "warn")
            return
        if os.path.normcase(bin_path) != os.path.normcase(raw):
            self._log_line("路径已修正: %s → %s" % (raw, bin_path), "info")
        self._apply_found_path(bin_path, "手动输入")

    def _resolve_game_path(self, path):
        """任意写法（根目录 / bin / exe / 斜杠 / 引号 / %VAR%）收敛成 bin 目录。
        判据始终是 bin\\<exe> 在不在，所以目录被改名或挪盘也不会认错副本。"""
        root, notes = normalize_game_path(path)
        if not root:
            return "", ["路径为空"]
        if has_anchor(root):
            if os.path.basename(os.path.normpath(path)).lower() != "bin":
                notes.append("已定位到 bin 子目录")
            return os.path.join(root, "bin"), notes
        if has_bin_exe(root):
            return root, notes
        return os.path.join(root, "bin"), notes + ["该目录下没有 %s" % GAME_ANCHOR_REL]

    def _get_embedded_js_dir(self):
        """返回随工具发布的完整内嵌 JavaScript 资源目录。"""
        candidates = [
            os.path.join(EXE_DIR, "embedded_javascript"),
            os.path.join(SCRIPT_DIR, "embedded_javascript"),
            # py/ 布局回退：内嵌脚本唯一副本在仓库根（避免 py/ 下再放一份会漂移的陈旧副本）
            os.path.join(os.path.dirname(SCRIPT_DIR), "embedded_javascript"),
        ]
        seen = set()
        for path in candidates:
            norm = os.path.normcase(os.path.abspath(path))
            if norm in seen:
                continue
            seen.add(norm)
            if not os.path.isdir(path):
                continue
            try:
                import embedded_bundle_patcher as patcher
                if not patcher.missing_js_files(path):
                    return path, ""
            except Exception as ex:
                return "", str(ex)
        return "", "缺少完整的 17 个 embedded_javascript 脚本"

    @staticmethod
    def _sha256_file(path):
        digest = hashlib.sha256()
        with open(path, 'rb') as stream:
            for chunk in iter(lambda: stream.read(1048576), b''):
                digest.update(chunk)
        return digest.hexdigest().upper()

    def _detect_game_files(self, bin_path):
        self._log_line(f"开始检测: {bin_path}", "step")

        # 1. 检查 ssr-stove-shield.exe
        exe_path = os.path.join(bin_path, GAME_EXE_NAME)
        exe_found = os.path.isfile(exe_path)

        # 1.5 检查内嵌注入脚本（加速 EXE 生成的前提）
        embedded_js_dir, embedded_js_error = self._get_embedded_js_dir()
        speed_assets_found = bool(embedded_js_dir)

        if exe_found:
            self._set_status("exe", f"✓ {GAME_EXE_NAME}", True)
            self._log_line(f"找到游戏 EXE: {GAME_EXE_NAME}", "ok")
        else:
            self._set_status("exe", "✗ 未找到", False)
            self._log_line(f"未找到 {GAME_EXE_NAME}，请确认路径正确", "warn")

        if speed_assets_found:
            self._set_status("js", "✓ 就绪", True)
            self._log_line(f"内嵌注入脚本: {embedded_js_dir}（17 个 JS）", "ok")
            self._log_line("加速 EXE 将基于当前游戏版本自动生成", "info")
        else:
            self._set_status("js", "✗ 不可用", False)
            self._log_line(f"内嵌注入脚本不可用: {embedded_js_error}", "warn")

        # 2. 检查 ssra 资源（繁转简的三个目标文件）
        gameres = os.path.join(bin_path, "appdata", "cznlive", "gameres")
        self.gameres_dir = gameres
        targets = (
            ("manifest", "manifest.ssra", "manifest.ssra"),
            ("part", "lang_zht_b03_0.ssrc", os.path.join("chunks", "lang_zht_b03_0.ssrc")),
            ("etag", "manifest.ssra.etag", "manifest.ssra.etag"),
        )
        ssra_found = 0
        for key, title, rel in targets:
            p = os.path.join(gameres, rel)
            if os.path.isfile(p):
                ssra_found += 1
                sz = os.path.getsize(p)
                size = "%.1f MB" % (sz / 1024**2) if sz >= 1024**2 else "%d B" % sz
                self._set_status(key, f"✓ {size}", True)
                self._log_line(f"找到 {title} ({size}): {p}", "ok")
            else:
                self._set_status(key, "✗ 未找到", False)
                self._log_line(f"未找到 {title}: {p}", "warn")

        # 繁转简与加速生成任一可用即可；能力位记住，任务结束后按位恢复按钮状态
        self._can_ssra = ssra_found == len(targets)
        self._can_speed = exe_found and speed_assets_found
        self.ssra_btn.configure(state="normal" if self._can_ssra else "disabled")
        self.speed_btn.configure(state="normal" if self._can_speed else "disabled")

        if self._can_ssra and self._can_speed:
            self._log_line("检测完成：繁转简与加速 EXE 均可用！", "ok")
        elif self._can_ssra:
            self._log_line("检测完成：可以进行繁转简！", "ok")
        elif self._can_speed:
            self._log_line("检测完成，可以生成加速 EXE！", "ok")
        else:
            self._log_line("检测完成，部分条件不满足，请检查", "warn")

    # ═══════════════════════════════════════════════════════════════
    # 繁转简（ssra）
    # ═══════════════════════════════════════════════════════════════
    def _start_ssra_zhcn(self):
        if self.is_running:
            return
        gameres = os.path.join(self.game_bin_path.get().strip(), "appdata", "cznlive", "gameres")
        if not os.path.isfile(os.path.join(gameres, "manifest.ssra")):
            messagebox.showwarning(
                "未找到 ssra 资源",
                "游戏目录下没有 gameres/manifest.ssra。\n"
                "请确认游戏已更新到 ssra 资源版本且路径正确。")
            return
        if not self._ensure_admin_or_confirm("繁转简（ssra）"):
            return
        if not messagebox.askyesno(
                "繁转简（ssra）",
                "将把官方繁中 text.db 转为简体并应用到游戏。\n\n"
                "• 原文件自动备份，可随时还原\n"
                "• 同步补丁器身份记录，避免启动时要求重新下载\n\n"
                "继续？"):
            return
        self.is_running = True
        self._stop_requested = False
        self.speed_btn.configure(state="disabled")
        self.ssra_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self._set_progress(0, "繁转简：开始...")
        threading.Thread(target=self._run_ssra_zhcn, args=(gameres,), daemon=True).start()

    def _run_ssra_zhcn(self, gameres):
        try:
            import ssra_zhcn
            patch_dir = os.path.join(EXE_DIR, "zhcn_patch")
            log = lambda m: self._log_line("  " + m)
            self._set_progress(0.3, "繁转简：构建中...")
            ssra_zhcn.build(gameres, patch_dir, log=log)
            if self._stop_requested:
                raise InterruptedError
            self._set_progress(0.7, "繁转简：等待应用...")

            def _ask_apply():
                result = messagebox.askyesno(
                    "构建完成 ✅",
                    "补丁已生成到 " + patch_dir + "\n\n是否立即应用到游戏目录？")
                try:
                    if result:
                        ssra_zhcn.apply(gameres, patch_dir, log=log)
                        self._log_line("已应用，启动游戏即可看到简体中文", "ok")
                    else:
                        self._log_line("已跳过应用，补丁保留在 " + patch_dir, "info")
                    self._set_progress(1.0, "繁转简完成！")
                except Exception as e:
                    self._log_line(f"应用失败: {e}", "error")
                    self._set_progress(0, "应用失败")

            self.after(0, _ask_apply)

        except InterruptedError:
            self._log_line("操作已被用户停止", "warn")
            self._set_progress(0, "已停止")

        except Exception as e:
            self._log_line(f"错误: {e}", "error")
            self._log_line(traceback.format_exc())
            self._set_progress(0, "出错")
            self.after(0, lambda: messagebox.showerror("错误", f"繁转简失败:\n{e}"))

        finally:
            def _done():
                self.is_running = False
                self.ssra_btn.configure(state="normal" if self._can_ssra else "disabled")
                self.speed_btn.configure(state="normal" if self._can_speed else "disabled")
                self.stop_btn.configure(state="disabled")
            self.after(0, _done)

    # ═══════════════════════════════════════════════════════════════
    # 加速 EXE 生成
    # ═══════════════════════════════════════════════════════════════
    def _start_speed_exe(self):
        if self.is_running:
            return
        embedded_js_dir, embedded_js_error = self._get_embedded_js_dir()
        if not embedded_js_dir:
            messagebox.showwarning(
                "内嵌脚本不可用",
                "缺少完整的 17 个 embedded_javascript 脚本：\n" + str(embedded_js_error))
            return
        source_exe = os.path.join(self.game_bin_path.get().strip(), GAME_EXE_NAME)
        if not os.path.isfile(source_exe):
            messagebox.showwarning(
                "未找到游戏 EXE",
                "游戏目录下没有 " + GAME_EXE_NAME + "。\n请先在「游戏目录」中确认路径。")
            return
        if not self._ensure_admin_or_confirm("生成加速 EXE"):
            return
        self.is_running = True
        self._stop_requested = False
        self.ssra_btn.configure(state="disabled")
        self.speed_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self._set_progress(0, "加速 EXE：开始...")
        threading.Thread(target=self._run_speed_exe, args=(embedded_js_dir, source_exe),
                         daemon=True).start()

    def _run_speed_exe(self, embedded_js_dir, source_exe):
        try:
            t0 = time.time()
            self._log_line("==================================================")
            self._log_line("开始生成加速 EXE", "step")
            self._log_line("==================================================")

            import embedded_bundle_patcher as patcher

            output_dir = os.path.join(EXE_DIR, "output")
            os.makedirs(output_dir, exist_ok=True)
            output_exe = os.path.join(output_dir, GAME_EXE_NAME)
            if os.path.isfile(output_exe):
                os.remove(output_exe)

            if self._stop_requested:
                raise InterruptedError()
            self._set_progress(0.3, "定位内嵌资源并注入 JS...")
            stats = patcher.patch_exe(
                source_exe,
                output_exe,
                embedded_js_dir,
                init_path=os.path.join(embedded_js_dir, "init.js"),
                toolkit_dir=EXE_DIR,
            )
            self._set_progress(0.9, "校验输出...")

            resource_path = "/".join(str(part) for part in stats["resource_path"])
            self._log_line(f"动态定位 PE 资源 {resource_path}: offset=0x{stats['resource_offset']:X}, size={stats['resource_size']:,}", "info")
            self._log_line(f"已清空 {stats['cleared_jbin']} 个 init.jbin，注入 {stats['injected_js']} 个 JS，资源大小保持不变", "ok")
            sz = os.path.getsize(output_exe) / 1024 / 1024
            self._log_line(f"已生成加速 EXE: {output_exe} ({sz:.1f} MB)", "ok")
            self._log_line(f"源 SHA256: {stats['source_sha256']}", "info")
            self._log_line(f"新 SHA256: {stats['output_sha256']}", "info")

            self._speed_source_sha256 = stats["source_sha256"]
            self._speed_source_was_patched = stats["source_was_patched"]

            self._set_progress(1.0, "完成！")
            self._log_line("==================================================")
            self._log_line(f"✅ 操作成功完成！耗时 {time.time() - t0:.1f} 秒", "ok")
            self._log_line(f"   输出目录: {output_dir}", "ok")
            self._log_line("==================================================")

            def _ask_replace():
                result = messagebox.askyesno(
                    "生成完成 ✅",
                    "加速 EXE 已生成。\n\n是否自动替换到游戏目录？\n（原文件将备份为 .bak）")
                if result:
                    self._auto_replace_bin(output_dir)
                else:
                    self._log_line("已跳过自动替换，请手动复制文件", "info")

            self.after(0, _ask_replace)

        except InterruptedError:
            self._log_line("操作已被用户停止", "warn")
            self._set_progress(0, "已停止")

        except Exception as e:
            self._log_line(f"错误: {e}", "error")
            self._log_line(traceback.format_exc())
            self._set_progress(0, "出错")
            self.after(0, lambda: messagebox.showerror("错误", f"生成加速 EXE 失败:\n{e}"))

        finally:
            def _done():
                self.is_running = False
                self.ssra_btn.configure(state="normal" if self._can_ssra else "disabled")
                self.speed_btn.configure(state="normal" if self._can_speed else "disabled")
                self.stop_btn.configure(state="disabled")
            self.after(0, _done)

    def _auto_replace_bin(self, output_dir):
        """把生成的加速 EXE 替换进游戏目录；原文件备份 .bak。
        游戏 EXE 在构建后被外部改动（如热更新）时拒绝覆盖，避免打坏新版。"""
        import shutil
        try:
            self._log_line("开始自动替换...", "step")
            src = os.path.join(output_dir, GAME_EXE_NAME)
            target = os.path.join(self.game_bin_path.get(), GAME_EXE_NAME)
            if not os.path.isfile(src):
                self._log_line("输出目录中未找到加速 EXE!", "error")
                return

            if os.path.exists(target):
                current_hash = self._sha256_file(target)
                if self._speed_source_sha256 and current_hash != self._speed_source_sha256:
                    raise RuntimeError(
                        "游戏 EXE 在构建后发生了变化，可能刚完成更新；为避免覆盖新版，请重新检测并生成。")
                bak_file = target + ".bak"
                # 源是未打补丁的官方 EXE 时，始终刷新备份以保留纯净官方版本
                if not self._speed_source_was_patched:
                    if os.path.exists(bak_file):
                        if self._sha256_file(bak_file) != current_hash:
                            archived = f"{bak_file}.{time.strftime('%Y%m%d_%H%M%S')}"
                            shutil.move(bak_file, archived)
                            self._log_line(f"  归档旧备份: {os.path.basename(archived)}", "info")
                    self._log_line(f"  备份当前游戏版本: {GAME_EXE_NAME} → {GAME_EXE_NAME}.bak", "info")
                    shutil.copy2(target, bak_file)
                elif not os.path.exists(bak_file):
                    self._log_line(f"  备份: {GAME_EXE_NAME} → {GAME_EXE_NAME}.bak", "info")
                    shutil.copy2(target, bak_file)
                else:
                    self._log_line(f"  备份已存在: {GAME_EXE_NAME}.bak（跳过）", "info")

            sz = os.path.getsize(src) / 1024 / 1024
            self._log_line(f"  替换: {GAME_EXE_NAME} ({sz:.0f} MB)", "step")
            shutil.copy2(src, target)

            self._log_line("✅ 自动替换完成！", "ok")
            messagebox.showinfo("替换完成 ✅",
                                f"已成功替换 {GAME_EXE_NAME}！\n原文件已备份为 .bak")

        except Exception as e:
            self._log_line(f"自动替换失败: {e}", "error")
            messagebox.showerror("替换失败", f"自动替换出错:\n{e}\n\n请手动复制文件。")


# ═══════════════════════════════════════════════════════════════════════
# 入口
# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    if "--locate-selftest" in sys.argv:
        # 无头自测：打印定位结果与逐层轨迹，作为路径定位的回归基线
        levels = BFS_DEEP_LEVELS if "--deep" in sys.argv else BFS_MAX_LEVELS
        t0 = time.perf_counter()
        hit, from_where, trail = locate_game_bin(levels=levels)
        for item in trail:
            print("  · %s" % item)
        print("结果: %s" % (hit or "(未找到)"))
        print("来源: %s" % (from_where or "-"))
        print("总耗时: %.1f ms" % ((time.perf_counter() - t0) * 1000))
        sys.exit(0 if hit else 1)
    enable_windows_dpi_awareness()
    app = ChaosZeroToolkit()
    app.mainloop()
