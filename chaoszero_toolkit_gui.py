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
ChaosZero Toolkit — 卡俄斯：噩梦 汉化工具
现代化 GUI 界面，基于 CustomTkinter
"""
import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox
import os
import sys
import threading
import time
import struct
import string
import hashlib
import traceback

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
COLOR_TEXT         = "#F8FAFC"       # 主标题/文本 (亮白)
COLOR_TEXT_DIM     = "#94A3B8"       # 次要说明文本 (灰白)
COLOR_BORDER       = "#383854"       # 分隔线/边框
COLOR_LOG_BG       = "#11111B"       # 日志终端背景 (极暗)
COLOR_TITLE_BG     = "#11111B"       # 顶部标题栏背景

GLOBAL_FONT = ("Microsoft YaHei UI", "Segoe UI")

GAME_EXE_NAME     = "ssr-stove-shield.exe"
GAME_FOLDER_NAME  = "ChaosZeroNightmare"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 打包后，exe 实际运行目录（而非临时解压目录）
# Nuitka: __nuitka_binary_dir 或 __compiled__；PyInstaller: sys.frozen
if "__compiled__" in dir() or hasattr(sys, 'frozen'):
    EXE_DIR = os.path.dirname(os.path.abspath(sys.argv[0]))
else:
    EXE_DIR = SCRIPT_DIR


class LogRedirector:
    """Redirect print() output to the GUI log widget."""
    def __init__(self, callback):
        self.callback = callback
        self.buffer = ""

    def write(self, text):
        if text:
            self.callback(text)

    def flush(self):
        pass


class ChaosZeroToolkit(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("ChaosZero Toolkit — 卡俄斯：噩梦 汉化工具")
        self.geometry("900x720")
        self.minsize(800, 600)
        self.configure(fg_color=COLOR_BG)

        # State
        self.game_bin_path = ctk.StringVar(value="")
        self.pack_dir = ""
        self.volumes_found = []
        self.has_zht = False
        self.is_running = False

        self._build_ui()

    # ═══════════════════════════════════════════════════════════════
    # UI 构建
    # ═══════════════════════════════════════════════════════════════
    def _build_ui(self):
        # ── 顶部标题栏 ──
        title_frame = ctk.CTkFrame(self, fg_color=COLOR_TITLE_BG, corner_radius=0, height=65)
        title_frame.pack(fill="x", padx=0, pady=0)
        title_frame.pack_propagate(False)

        title_label = ctk.CTkLabel(
            title_frame,
            text="⚔ ChaosZero Toolkit",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=22, weight="bold"),
            text_color="#FFFFFF"
        )
        title_label.pack(side="left", padx=20, pady=15)

        version_label = ctk.CTkLabel(
            title_frame,
            text="v1.0.2",
            font=ctk.CTkFont(family="Consolas", size=12),
            text_color=COLOR_TEXT_DIM
        )
        version_label.pack(side="right", padx=(8, 20), pady=15)

        qq_btn = ctk.CTkButton(
            title_frame,
            text="💬 QQ群",
            width=82,
            height=30,
            corner_radius=8,
            fg_color="transparent",
            hover_color=COLOR_BG_CARD,
            text_color="#FFFFFF",
            border_width=1,
            border_color=COLOR_BORDER,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            command=lambda: self._copy_to_clipboard("777529227")
        )
        qq_btn.pack(side="right", padx=4, pady=15)

        github_btn = ctk.CTkButton(
            title_frame,
            text="⭐ GitHub",
            width=92,
            height=30,
            corner_radius=8,
            fg_color="transparent",
            hover_color=COLOR_BG_CARD,
            text_color="#FFFFFF",
            border_width=1,
            border_color=COLOR_BORDER,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            command=lambda: self._open_url("https://github.com/NineS11942/ChaosZeroYuna-Engine-Unpacker-Simplified-Chinese-Localization-Patch")
        )
        github_btn.pack(side="right", padx=4, pady=15)

        # ── 主内容区 ──
        main_frame = ctk.CTkFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=20, pady=10)

        # Step 1: 选择游戏路径
        self._build_path_section(main_frame)

        # Step 2: 状态面板
        self._build_status_section(main_frame)

        # Step 3: 操作按钮
        self._build_action_section(main_frame)

        # Step 4: 进度条
        self._build_progress_section(main_frame)

        # Step 5: 日志区域
        self._build_log_section(main_frame)

    def _build_path_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLOR_BG_CARD, corner_radius=10,
                             border_width=1, border_color=COLOR_BORDER)
        frame.pack(fill="x", pady=(0, 8))

        header = ctk.CTkLabel(
            frame,
            text=" 📁 第一步：选择游戏目录",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=15, weight="bold"),
            text_color=COLOR_TEXT,
            anchor="w"
        )
        header.pack(fill="x", padx=15, pady=(12, 2))

        hint = ctk.CTkLabel(
            frame,
            text="选择 ChaosZeroNightmare 文件夹，或点击「自动寻找」让工具扫描全盘",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
            text_color=COLOR_TEXT_DIM,
            anchor="w"
        )
        hint.pack(fill="x", padx=18, pady=(0, 8))

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
        self.path_entry.pack(side="left", fill="x", expand=True, padx=(0, 10))

        self.auto_find_btn = ctk.CTkButton(
            row,
            text="🔍 自动寻找",
            width=100,
            height=36,
            corner_radius=6,
            fg_color=COLOR_SUCCESS,
            hover_color="#059669", # 更深的绿
            text_color="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            command=self._auto_find_game
        )
        self.auto_find_btn.pack(side="right", padx=(0, 8))

        browse_btn = ctk.CTkButton(
            row,
            text="📂 浏览",
            width=80,
            height=36,
            corner_radius=6,
            fg_color=COLOR_ACCENT,
            hover_color=COLOR_ACCENT_HOVER,
            text_color="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            command=self._browse_game_dir
        )
        browse_btn.pack(side="right")

    def _build_status_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLOR_BG_CARD, corner_radius=10,
                             border_width=1, border_color=COLOR_BORDER)
        frame.pack(fill="x", pady=(0, 8))

        header = ctk.CTkLabel(
            frame,
            text=" 📊 状态检测",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=15, weight="bold"),
            text_color=COLOR_TEXT,
            anchor="w"
        )
        header.pack(fill="x", padx=15, pady=(12, 4))

        # 状态网格
        grid = ctk.CTkFrame(frame, fg_color="transparent")
        grid.pack(fill="x", padx=15, pady=(0, 15))
        grid.columnconfigure((0, 1, 2, 3), weight=1)

        # 4 个状态指示器
        self.status_labels = {}
        indicators = [
            ("exe", "游戏启动器", "⏳ 等待选择"),
            ("volumes", "数据分卷", "⏳ 等待选择"),
            ("zht", "繁中语言包", "⏳ 等待检测"),
            ("tsv", "汉化文本库", "⏳ 等待检测"),
        ]
        for col, (key, title, default) in enumerate(indicators):
            card = ctk.CTkFrame(grid, fg_color="#313244", corner_radius=6,
                                border_width=1, border_color="#45475A")
            card.grid(row=0, column=col, padx=5, pady=2, sticky="nsew")

            t = ctk.CTkLabel(card, text=title, font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
                             text_color=COLOR_TEXT_DIM)
            t.pack(pady=(10, 2))

            v = ctk.CTkLabel(card, text=default, font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
                             text_color=COLOR_TEXT)
            v.pack(pady=(0, 10))
            self.status_labels[key] = v

    def _build_action_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color="transparent")
        frame.pack(fill="x", pady=(0, 8))

        options_frame = ctk.CTkFrame(frame, fg_color="transparent")
        options_frame.pack(side="top", fill="x", pady=(0, 10))

        left_options = ctk.CTkFrame(options_frame, fg_color="transparent")
        left_options.pack(side="left", fill="y")

        right_options = ctk.CTkFrame(options_frame, fg_color="transparent")
        right_options.pack(side="right", fill="y")

        self.use_simplified_var = ctk.BooleanVar(value=False)
        self.use_simplified_cb = ctk.CTkCheckBox(
            left_options,
            text="纯繁转简",
            variable=self.use_simplified_var,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            text_color=COLOR_TEXT
        )
        self.use_simplified_cb.pack(side="left", anchor="w", padx=(2, 5))

        self.use_local_zht_var = ctk.BooleanVar(value=False)
        self.use_local_zht_cb = ctk.CTkCheckBox(
            left_options,
            text="用本地 (用本地的tsv文件构建 一般无特殊用途不用勾选)",
            variable=self.use_local_zht_var,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            text_color=COLOR_TEXT
        )
        self.use_local_zht_cb.pack(side="left", anchor="w", padx=(2, 10))

        self.apply_translation_var = ctk.BooleanVar(value=False)
        self.apply_translation_cb = ctk.CTkCheckBox(
            right_options,
            text="汉化",
            variable=self.apply_translation_var,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            text_color=COLOR_TEXT
        )
        self.apply_translation_cb.pack(side="left", anchor="w", padx=(10, 5))

        self.inject_init_js_var = ctk.BooleanVar(value=False)
        self.inject_init_js_cb = ctk.CTkCheckBox(
            right_options,
            text="注入加速（自动适配游戏更新）",
            variable=self.inject_init_js_var,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            text_color=COLOR_TEXT
        )
        self.inject_init_js_cb.pack(side="left", anchor="w", padx=(5, 0))

        self.start_btn = ctk.CTkButton(
            frame,
            text="🚀 构建封包",
            height=44,
            corner_radius=8,
            fg_color=COLOR_ACCENT,
            hover_color=COLOR_ACCENT_HOVER,
            text_color="#FFFFFF",
            text_color_disabled="#FFFFFF",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=15, weight="bold"),
            command=self._start_translation,
            state="disabled"
        )
        self.start_btn.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.stop_btn = ctk.CTkButton(
            frame,
            text="⏹ 停止",
            height=44,
            width=100,
            corner_radius=8,
            fg_color="#313244",
            hover_color="#45475A",
            text_color="#F8FAFC",
            border_width=1,
            border_color=COLOR_BORDER,
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=14, weight="bold"),
            command=self._stop_translation,
            state="disabled"
        )
        self.stop_btn.pack(side="right", padx=(0, 0))

    def _build_progress_section(self, parent):
        frame = ctk.CTkFrame(parent, fg_color=COLOR_BG_CARD, corner_radius=10,
                             border_width=1, border_color=COLOR_BORDER)
        frame.pack(fill="x", pady=(0, 8))

        row = ctk.CTkFrame(frame, fg_color="transparent")
        row.pack(fill="x", padx=15, pady=(10, 2))

        self.progress_label = ctk.CTkLabel(
            row,
            text="进度：等待操作",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13),
            text_color=COLOR_TEXT,
            anchor="w"
        )
        self.progress_label.pack(side="left")

        self.progress_pct = ctk.CTkLabel(
            row,
            text="0%",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=13, weight="bold"),
            text_color=COLOR_SUCCESS,
            anchor="e"
        )
        self.progress_pct.pack(side="right")

        self.progress_bar = ctk.CTkProgressBar(
            frame,
            height=10,
            corner_radius=5,
            fg_color="#313244",
            progress_color=COLOR_SUCCESS
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
            header_row,
            text=" 📋 运行日志",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=14, weight="bold"),
            text_color=COLOR_TEXT,
            anchor="w"
        ).pack(side="left")

        clear_btn = ctk.CTkButton(
            header_row,
            text="清空",
            width=50,
            height=26,
            corner_radius=4,
            fg_color="#313244",
            text_color="#F8FAFC",
            hover_color="#45475A",
            font=ctk.CTkFont(family=GLOBAL_FONT[0], size=12),
            command=self._clear_log
        )
        clear_btn.pack(side="right")

        self.log_text = ctk.CTkTextbox(
            frame,
            font=ctk.CTkFont(family="Consolas", size=13),
            fg_color=COLOR_LOG_BG,
            text_color="#A6ACCD",  # 稍微偏蓝的柔和代码颜色
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
    def _log(self, text, tag=None):
        """Thread-safe log append."""
        def _append():
            self.log_text.configure(state="normal")
            self.log_text.insert("end", text)
            self.log_text.see("end")
            self.log_text.configure(state="disabled")
        self.after(0, _append)

    def _log_line(self, msg, level="info"):
        ts = time.strftime("%H:%M:%S")
        prefix = {"info": "ℹ", "ok": "✅", "warn": "⚠", "error": "❌", "step": "▶"}.get(level, "●")
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

    # ═══════════════════════════════════════════════════════════════
    # 自动寻找游戏目录
    # ═══════════════════════════════════════════════════════════════
    def _auto_find_game(self):
        """扫描所有磁盘，查找 ChaosZeroNightmare 文件夹。"""
        self._log_line("开始自动寻找游戏目录...", "step")
        self.auto_find_btn.configure(state="disabled", text="🔍 搜索中...")

        thread = threading.Thread(target=self._auto_find_worker, daemon=True)
        thread.start()

    def _auto_find_worker(self):
        """后台线程：扫描所有磁盘寻找游戏文件夹，找到后立即停止。"""
        found = None
        try:
            # 获取所有磁盘盘符
            drives = []
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    drives.append(drive)

            self._log_line(f"扫描 {len(drives)} 个磁盘: {', '.join(drives)}", "info")

            for drive in drives:
                if found:
                    break
                self._log_line(f"  扫描 {drive} ...", "info")
                try:
                    for root, dirs, files in os.walk(drive):
                        # 限制搜索深度（最多5层）避免时间过长
                        depth = root.replace(drive, '').count(os.sep)
                        if depth > 4:
                            dirs.clear()
                            continue
                        # 跳过系统/隐藏目录
                        dirs[:] = [d for d in dirs if not d.startswith('.')
                                   and d not in ('Windows', '$Recycle.Bin', 'System Volume Information',
                                                 'ProgramData', 'Recovery', 'node_modules', '.git')]
                        if GAME_FOLDER_NAME in dirs:
                            game_path = os.path.join(root, GAME_FOLDER_NAME)
                            bin_path = os.path.join(game_path, "bin")
                            if os.path.isdir(bin_path):
                                exe_path = os.path.join(bin_path, GAME_EXE_NAME)
                                if os.path.isfile(exe_path):
                                    found = bin_path
                                    self._log_line(f"  ✅ 找到: {bin_path}", "ok")
                                    break  # 立即停止扫描
                except PermissionError:
                    continue

            if found:
                self._log_line(f"自动定位成功: {found}", "ok")
                self.after(0, lambda: self._apply_found_path(found))
            else:
                self._log_line("未在任何磁盘中找到 ChaosZeroNightmare 游戏目录", "error")
                self.after(0, lambda: messagebox.showwarning(
                    "未找到游戏",
                    f"未在任何磁盘中找到 {GAME_FOLDER_NAME} 文件夹。\n\n"
                    "请使用「浏览」按钮手动选择游戏的 bin 目录。"
                ))
        except Exception as e:
            self._log_line(f"自动寻找出错: {e}", "error")
        finally:
            self.after(0, lambda: self.auto_find_btn.configure(state="normal", text="🔍 自动寻找"))

    def _apply_found_path(self, bin_path):
        """应用找到的游戏路径。"""
        self.game_bin_path.set(bin_path)
        self._detect_game_files(bin_path)

    # ═══════════════════════════════════════════════════════════════
    # 路径选择 & 检测
    # ═══════════════════════════════════════════════════════════════
    def _browse_game_dir(self):
        path = filedialog.askdirectory(
            title="选择 ChaosZeroNightmare 文件夹或 bin 目录",
            initialdir=self.game_bin_path.get() or os.path.expanduser("~")
        )
        if path:
            path = self._resolve_game_path(path)
            self.game_bin_path.set(path)
            self._detect_game_files(path)

    def _resolve_game_path(self, path):
        """
智能路径解析：
- 如果选的是 ChaosZeroNightmare 根目录，自动进入 bin 子目录
- 如果选的是 bin 目录，直接使用
"""
        basename = os.path.basename(path)
        # 用户选了根目录 ChaosZeroNightmare
        if basename == GAME_FOLDER_NAME:
            bin_sub = os.path.join(path, "bin")
            if os.path.isdir(bin_sub):
                self._log_line(f"自动定位到 bin 子目录: {bin_sub}", "info")
                return bin_sub
        return path

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
            self._set_status("exe", f"✅ {GAME_EXE_NAME}", True)
            self._log_line(f"找到游戏 EXE: {GAME_EXE_NAME}", "ok")
        else:
            self._set_status("exe", "❌ 未找到", False)
            self._log_line(f"未找到 {GAME_EXE_NAME}，请确认路径正确", "warn")

        if speed_assets_found:
            self._log_line(f"内嵌注入脚本: {embedded_js_dir}（17 个 JS）", "ok")
            self._log_line("加速 EXE 将基于当前游戏版本自动生成", "info")
        else:
            self._log_line(f"内嵌注入脚本不可用: {embedded_js_error}", "warn")

        # 2. 检查 data.pack 分卷
        pack_dir = os.path.join(bin_path, "appdata", "cznlive")
        self.pack_dir = pack_dir
        self.volumes_found = []

        if os.path.exists(pack_dir):
            pack_base = os.path.join(pack_dir, "data.pack")
            if os.path.exists(pack_base):
                self.volumes_found.append(pack_base)
                n = 1
                while True:
                    vpath = f"{pack_base}~{n}"
                    if not os.path.exists(vpath):
                        break
                    self.volumes_found.append(vpath)
                    n += 1

        if self.volumes_found:
            total_gb = sum(os.path.getsize(v) for v in self.volumes_found) / 1024**3
            vol_text = f"✅ {len(self.volumes_found)} 卷 ({total_gb:.2f} GB)"
            self._set_status("volumes", vol_text, True)
            self._log_line(f"找到 {len(self.volumes_found)} 个分卷, 总计 {total_gb:.2f} GB", "ok")
            for v in self.volumes_found:
                sz = os.path.getsize(v) / 1024**2
                self._log_line(f"  → {os.path.basename(v)}: {sz:.0f} MB")
        else:
            self._set_status("volumes", "❌ 未找到", False)
            self._log_line(f"未找到 data.pack，路径: {pack_dir}", "error")

        # 3. 检查 ZHT 语言包是否已下载
        self.has_zht = self._check_zht_in_pack()
        if self.has_zht:
            self._set_status("zht", "✅ 已下载", True)
            self._log_line("ZHT (繁体中文) 语言包已存在于 data.pack 中", "ok")
            if hasattr(self, 'use_simplified_cb'):
                self.use_simplified_cb.configure(state="normal")
                self.use_local_zht_cb.configure(state="normal")
        else:
            self._set_status("zht", "⚠ 未下载", False)
            self._log_line("ZHT 语言包未下载，可切换替换 KO (韩文) 版本", "warn")
            if hasattr(self, 'use_simplified_cb'):
                self.use_simplified_cb.configure(state="disabled")
                self.use_simplified_var.set(False)
                self.use_local_zht_cb.configure(state="disabled")
                self.use_local_zht_var.set(False)

        # 4. 检查 TSV 翻译文件（优先从 exe 所在目录查找）
        tsv_path = os.path.join(EXE_DIR, "text_ko_text.tsv")
        if not os.path.exists(tsv_path):
            # 回退到脚本目录，再回退到仓库根（py/ 布局下 TSV 唯一副本在上级）
            for _cand in (
                os.path.join(SCRIPT_DIR, "text_ko_text.tsv"),
                os.path.join(os.path.dirname(SCRIPT_DIR), "text_ko_text.tsv"),
            ):
                if os.path.exists(_cand):
                    tsv_path = _cand
                    break

        if os.path.exists(tsv_path):
            sz = os.path.getsize(tsv_path) / 1024
            self._set_status("tsv", f"✅ {sz:.0f} KB", True)
            self._log_line(f"翻译 TSV: {tsv_path} ({sz:.0f} KB)", "ok")
            self.tsv_path = tsv_path
        else:
            self._set_status("tsv", "❌ 未找到", False)
            self._log_line("未找到翻译文件 text_ko_text.tsv", "error")
            self.tsv_path = None

        # 启用/禁用开始按钮（汉化与加速生成任一可用即可）
        can_start_hanhua = len(self.volumes_found) > 0 and self.tsv_path is not None
        can_start_speed = exe_found and speed_assets_found
        can_start = can_start_hanhua or can_start_speed
        self.start_btn.configure(state="normal" if can_start else "disabled")

        if can_start_hanhua and can_start_speed:
            self._log_line("检测完成，可以开始汉化及自动生成加速 EXE！", "ok")
        elif can_start_hanhua:
            self._log_line("检测完成，可以开始汉化！", "ok")
        elif can_start_speed:
            self._log_line("检测完成，可以基于当前游戏版本生成加速 EXE！", "ok")
        else:
            self._log_line("检测完成，部分条件不满足，请检查", "warn")

    def _check_zht_in_pack(self):
        """Quick check: scan the pack for text/zht/text.db entry."""
        if not self.volumes_found:
            return False
        try:
            # 导入核心模块的加密函数
            sys.path.insert(0, SCRIPT_DIR)
            from rebuild_ko_to_zht import MultiVolumePack, cdbm_hash, PACK_XOR_KEY
            import numpy as np

            pack = MultiVolumePack(self.pack_dir)
            _PACK_XOR_NP = np.frombuffer(PACK_XOR_KEY, dtype=np.uint8)

            # 读取 header 获取 hash_count
            hdr = pack.read_xor(0, 38)
            if hdr[:5] != b'PLPcK':
                pack.close()
                return False
            hash_count = struct.unpack_from('<I', hdr, 21)[0]

            # 查找 ZHT bucket
            zht_key = b'text/zht/text.db'
            bucket = cdbm_hash(zht_key) % hash_count

            ht_data = pack.read_xor(43, hash_count * 5)
            off5 = bucket * 5
            ptr_hi = ht_data[off5]
            ptr_lo = struct.unpack_from('<I', ht_data[off5+1:off5+5])[0]
            chain = ptr_lo + (ptr_hi << 32)

            found = False
            safety = 0
            while chain > 0 and chain + 15 <= pack.total_size and safety < 100:
                safety += 1
                chunk_hdr = pack.read_xor(chain, 15)
                ds = struct.unpack_from('<I', chunk_hdr, 0)[0]
                kl = chunk_hdr[5]
                vs = struct.unpack_from('<I', chunk_hdr, 6)[0]
                if ds == 0 or kl == 0:
                    break
                key = pack.read_xor(chain + 15, kl)
                if key == zht_key and vs > 1000:  # ZHT exists with real data
                    found = True
                    break
                nh = chunk_hdr[10]
                nl = struct.unpack_from('<I', chunk_hdr, 11)[0]
                np_ = nl + (nh << 32)
                if np_ == 0 or np_ == chain:
                    break
                chain = np_

            pack.close()
            return found
        except Exception as e:
            self._log_line(f"ZHT 检测异常: {e}", "warn")
            return False

    # ═══════════════════════════════════════════════════════════════
    # 汉化核心流程
    # ═══════════════════════════════════════════════════════════════
    def _start_translation(self):
        if self.is_running:
            return

        # ZHT 未下载的提示（仅在勾选了汉化时才弹出）
        apply_translation = getattr(self, 'apply_translation_var', None) and self.apply_translation_var.get()
        if apply_translation and not self.has_zht:
            result = messagebox.askyesno(
                "ZHT 语言包未检测到",
                "检测到您尚未下载 ZHT（繁体中文）语言包。\n\n"
                "是否自动切换为替换韩文（KO）版本？\n\n"
                "• 选「是」→ 替换 KO text.db（韩文→中文）\n"
                "• 选「否」→ 取消操作",
                icon="warning"
            )
            if not result:
                self._log_line("用户取消操作", "warn")
                return
            self.replace_mode = "ko"
            self._log_line("模式：替换 KO (韩文) text.db → 中文", "step")
        elif apply_translation:
            self.replace_mode = "zht"
            self._log_line("模式：替换 ZHT (繁中) text.db → 简体中文", "step")
        else:
            self.replace_mode = None

        self.is_running = True
        self._stop_requested = False
        self.start_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self._set_progress(0, "正在启动...")

        # 在后台线程运行
        thread = threading.Thread(target=self._run_translation, daemon=True)
        thread.start()

    def _stop_translation(self):
        self._stop_requested = True
        self._log_line("正在停止...", "warn")

    def _run_translation(self):
        """后台线程：执行解包→翻译/注入→重新打包。"""
        try:
            t0 = time.time()
            self._log_line("==================================================")
            self._log_line("开始流程", "step")
            self._log_line("==================================================")

            import importlib
            sys.path.insert(0, SCRIPT_DIR)
            import rebuild_ko_to_zht as rebuild
            importlib.reload(rebuild)

            output_dir = os.path.join(EXE_DIR, "bin_full_rebuild")
            os.makedirs(output_dir, exist_ok=True)

            apply_translation = getattr(self, 'apply_translation_var', None) and self.apply_translation_var.get()
            inject_init_js = getattr(self, 'inject_init_js_var', None) and self.inject_init_js_var.get()

            if not apply_translation and not inject_init_js:
                self._log_line("未勾选任何操作，已完成。", "warn")
                self._set_progress(1.0, "完成！")
                return

            ok = True
            replaced = 0
            produced_files = []
            self._speed_source_sha256 = ""
            self._speed_source_was_patched = False

            # 清理上一次构建的旧输出
            for filename in os.listdir(output_dir):
                stale_path = os.path.join(output_dir, filename)
                if not os.path.isfile(stale_path):
                    continue
                if filename.startswith("data.pack") or filename == GAME_EXE_NAME:
                    os.remove(stale_path)

            old_stdout = sys.stdout
            sys.stdout = LogRedirector(lambda t: self._log(t))

            # ==== 1. 汉化处理 ====
            if apply_translation:
                self._log_line(">>> 执行汉化: data.pack", "step")
                rebuild.PACK_DIR = self.pack_dir
                if getattr(self, 'use_simplified_var', None) and self.use_simplified_var.get():
                    rebuild.T2S_MODE = True
                    rebuild.LOCAL_ZHT_MODE = getattr(self, 'use_local_zht_var', None) and self.use_local_zht_var.get()
                else:
                    rebuild.T2S_MODE = False
                    rebuild.LOCAL_ZHT_MODE = False
                    rebuild.TSV_PATH = self.tsv_path

                rebuild.OUTPUT_DIR = output_dir

                if self._stop_requested: raise InterruptedError()
                self._set_progress(0.1, "提取 data.pack...")
                entries, orig_header, orig_ver5, hash_count = rebuild.extract_all_files(self.pack_dir)

                if self._stop_requested: raise InterruptedError()
                self._set_progress(0.3, "文本替换...")
                if self.replace_mode == "ko":
                    rebuild.ZHT_DB_KEY = rebuild.KO_DB_KEY

                if getattr(rebuild, 'T2S_MODE', False):
                    zht_tsv_path = os.path.join(SCRIPT_DIR, "text_zht_text(纯繁转简).tsv") if getattr(rebuild, 'LOCAL_ZHT_MODE', False) else None
                    if getattr(rebuild, 'LOCAL_ZHT_MODE', False) and not os.path.exists(zht_tsv_path):
                        for _cand in (
                            os.path.join(EXE_DIR, "text_zht_text(纯繁转简).tsv"),
                            os.path.join(os.path.dirname(SCRIPT_DIR), "text_zht_text(纯繁转简).tsv"),
                        ):
                            if os.path.exists(_cand):
                                zht_tsv_path = _cand
                                break
                    replaced = rebuild.process_zht_to_zhs(entries, tsv_path=zht_tsv_path)
                else:
                    replaced = rebuild.process_ko_to_zht(entries, self.tsv_path)

                if self._stop_requested: raise InterruptedError()
                self._set_progress(0.5, "重建 data.pack...")
                rebuild.rebuild_and_write(entries, orig_header, orig_ver5, hash_count, output_dir)
                produced_files.extend(
                    filename for filename in os.listdir(output_dir)
                    if filename.startswith("data.pack")
                    and os.path.isfile(os.path.join(output_dir, filename))
                )

                if self._stop_requested: raise InterruptedError()
                self._set_progress(0.7, "验证 data.pack...")
                if not rebuild.verify_pack(output_dir, entries):
                    ok = False
                    self._log_line("⚠ data.pack 验证发现问题", "warn")

            # ==== 2. 生成加速 EXE（补丁游戏 EXE 内嵌 JS bundle）====
            if inject_init_js and ok:
                self._log_line(">>> 执行注入: 当前游戏 EXE 内嵌 bundle", "step")
                self._set_progress(0.8, "定位内嵌资源并注入 JS...")
                try:
                    import embedded_bundle_patcher as patcher
                    importlib.reload(patcher)

                    embedded_js_dir, embedded_js_error = self._get_embedded_js_dir()
                    if not embedded_js_dir:
                        raise FileNotFoundError(embedded_js_error)

                    source_exe = os.path.join(self.game_bin_path.get(), GAME_EXE_NAME)
                    output_exe = os.path.join(output_dir, GAME_EXE_NAME)

                    stats = patcher.patch_exe(
                        source_exe,
                        output_exe,
                        embedded_js_dir,
                        init_path=os.path.join(embedded_js_dir, "init.js"),
                        toolkit_dir=EXE_DIR,
                    )

                    sz = os.path.getsize(output_exe) / 1024 / 1024
                    resource_path = "/".join(str(part) for part in stats["resource_path"])
                    self._log_line(f"动态定位 PE 资源 {resource_path}: offset=0x{stats['resource_offset']:X}, size={stats['resource_size']:,}", "info")
                    self._log_line(f"已清空 {stats['cleared_jbin']} 个 init.jbin，注入 {stats['injected_js']} 个 JS，资源大小保持不变", "ok")
                    self._log_line(f"已生成加速 EXE: {output_exe} ({sz:.1f} MB)", "ok")
                    self._log_line(f"源 SHA256: {stats['source_sha256']}", "info")
                    self._log_line(f"新 SHA256: {stats['output_sha256']}", "info")

                    self._speed_source_sha256 = stats["source_sha256"]
                    self._speed_source_was_patched = stats["source_was_patched"]
                    produced_files.append(GAME_EXE_NAME)
                except Exception as ex:
                    self._log_line(f"❌ 加速 EXE 自动生成失败: {ex}", "error")
                    ok = False

            sys.stdout = old_stdout
            elapsed = time.time() - t0
            self._set_progress(1.0, "完成！")

            if ok:
                self._log_line("==================================================")
                self._log_line(f"✅ 操作成功完成！耗时 {elapsed:.1f} 秒", "ok")
                self._log_line(f"   输出目录: {output_dir}", "ok")
                self._log_line("==================================================")

                _output_dir = output_dir
                _produced_files = tuple(dict.fromkeys(produced_files))

                def _ask_replace():
                    from tkinter import messagebox
                    result = messagebox.askyesno(
                        "操作完成 ✅",
                        "打包成功！\n\n"
                        "是否自动将所有修改的文件（data.pack / 加速 EXE）\n"
                        "替换到游戏目录中？\n"
                        "（原文件将备份为 .bak）"
                    )
                    if result:
                        self._auto_replace_pack(_output_dir, self.game_bin_path.get(), _produced_files)
                    else:
                        self._log_line("已跳过自动替换，请手动复制文件", "info")

                self.after(0, _ask_replace)

        except InterruptedError:
            sys.stdout = old_stdout if 'old_stdout' in dir() else sys.__stdout__
            self._log_line("操作已被用户停止", "warn")
            self._set_progress(0, "已停止")

        except Exception as e:
            if 'old_stdout' in dir(): sys.stdout = old_stdout
            else: sys.stdout = sys.__stdout__
            self._log_line(f"错误: {e}", "error")
            import traceback
            self._log_line(traceback.format_exc())
            self._set_progress(0, "出错")
            from tkinter import messagebox
            self.after(0, lambda: messagebox.showerror("错误", f"处理过程出错:\n{e}"))

        finally:
            self.is_running = False
            self.after(0, lambda: self.start_btn.configure(state="normal"))
            self.after(0, lambda: self.stop_btn.configure(state="disabled"))

    def _auto_replace_pack(self, output_dir, bin_path, filenames=None):
        """将输出文件替换到游戏目录，原文件备份为 .bak"""
        import shutil
        from tkinter import messagebox
        try:
            self._log_line("开始自动替换...", "step")

            if filenames is None:
                filenames = os.listdir(output_dir)
            pack_files = [
                filename for filename in filenames
                if os.path.isfile(os.path.join(output_dir, filename))
            ]

            if not pack_files:
                self._log_line("输出目录中未找到任何文件!", "error")
                return

            self._log_line(f"  找到 {len(pack_files)} 个文件待替换", "info")

            # 游戏 EXE 在构建后被外部改动（如热更新）时拒绝覆盖
            if GAME_EXE_NAME in pack_files:
                target_exe = os.path.join(bin_path, GAME_EXE_NAME)
                if os.path.exists(target_exe):
                    expected_hash = getattr(self, "_speed_source_sha256", "")
                    current_hash = self._sha256_file(target_exe)
                    if expected_hash and current_hash != expected_hash:
                        raise RuntimeError(
                            "游戏 EXE 在构建后发生了变化，可能刚完成更新；为避免覆盖新版，请重新检测并生成。"
                        )

            for fname in pack_files:
                # Decide destination
                if fname.startswith("data.pack"):
                    target_file = os.path.join(bin_path, "appdata", "cznlive", fname)
                elif fname.startswith("bundle.pack") or fname == GAME_EXE_NAME:
                    target_file = os.path.join(bin_path, fname)
                else:
                    target_file = os.path.join(bin_path, fname)

                # Backup
                if os.path.exists(target_file):
                    bak_file = target_file + ".bak"
                    # 源是未打补丁的官方 EXE 时，始终刷新备份以保留纯净官方版本
                    refresh_exe_backup = fname == GAME_EXE_NAME and not getattr(self, "_speed_source_was_patched", False)
                    if refresh_exe_backup:
                        if os.path.exists(bak_file):
                            backup_hash = self._sha256_file(bak_file)
                            target_hash = self._sha256_file(target_file)
                            if backup_hash != target_hash:
                                stamp = time.strftime("%Y%m%d_%H%M%S")
                                archived_bak = f"{bak_file}.{stamp}"
                                shutil.move(bak_file, archived_bak)
                                self._log_line(f"  归档旧备份: {os.path.basename(archived_bak)}", "info")
                        self._log_line(f"  备份当前游戏版本: {fname} → {fname}.bak", "info")
                        shutil.copy2(target_file, bak_file)
                    else:
                        if not os.path.exists(bak_file):
                            self._log_line(f"  备份: {fname} → {fname}.bak", "info")
                            shutil.copy2(target_file, bak_file)
                        else:
                            self._log_line(f"  备份已存在: {fname}.bak（跳过）", "info")

                # Copy
                src = os.path.join(output_dir, fname)
                sz = os.path.getsize(src) / 1024 / 1024
                self._log_line(f"  替换: {fname} ({sz:.0f} MB)", "step")
                shutil.copy2(src, target_file)

            self._log_line(f"✅ 自动替换完成！共替换 {len(pack_files)} 个文件", "ok")
            messagebox.showinfo("替换完成 ✅", f"已成功替换 {len(pack_files)} 个文件！\n原文件已备份为 .bak")

        except Exception as e:
            self._log_line(f"自动替换失败: {e}", "error")
            messagebox.showerror("替换失败", f"自动替换出错:\n{e}\n\n请手动复制文件。")


# ═══════════════════════════════════════════════════════════════════════
# 入口
# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    app = ChaosZeroToolkit()
    app.mainloop()
