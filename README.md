# ChaosZeroNightmare-Toolkit-Extra

卡厄斯梦境（Chaos Zero Nightmare）汉化与游戏内变速工具，社区维护拓展版。

> 请支持原作者：[NineS11942 / ChaosZero-Toolkit](https://github.com/NineS11942/ChaosZero-Toolkit)

## 功能

### 原作者 V2.0 原有功能

- **变速齿轮**：`F9` 加速（2x/3x/5x）· `F10` 重置 1x · `F11` 动画跳过 · `F12` 显隐 UI
- 按键可在 `speed_config.txt` 自定义
- 直接补丁游戏 EXE 内嵌脚本，游戏更新后重新补丁原始 exe 自动适配

### 社区维护版新增功能

- **繁转简（ssra）**：适配游戏新的 ssra 资源体系（`gameres/manifest.ssra` + `chunks/*.ssrc`），提取官方繁中 `text/zht/text.db` → OpenCC 转简 → 与官方逐字节同尺寸重建分卷并应用；原文件自动备份、可一键还原；同步补丁器身份记录，patching 不再要求重新下载。这是当前唯一的汉化路径（旧 data.pack 汉化线已随资源体系迁移退役）
- **`F8` 强制回主界面**（复位 1x 并关闭动画跳过）：相当于无需代理的进程内重启
- **状态记忆**：倍速与动画跳过状态自动记忆，重启游戏后自动应用
- **按下期瞬时 1x**：修复高倍速下轻点被误判为长按的问题
- **`keepalive_sec`**：倍速被游戏改回后的维持周期可配置
- **管理员助手**：启动时检测当前权限并在标题栏常驻显示；未提权时执行功能前会醒目提醒，可一键以管理员身份重启工具，无需右键「以管理员身份运行」；系统关闭 UAC（EnableLUA=0）时给出明确指引
- **现代卡片式 GUI**：步骤化布局、就绪检测芯片、日志合帧刷新、高分屏清晰渲染（Win10/11 显示缩放适配）

## 使用

从 [Releases](../../releases) 下载压缩包，解压到游戏目录 `ChaosZeroNightmare` **所在的同一目录**，运行 `ChaosZero-Toolkit.exe`（未提权时工具会提示并可直接申请管理员）。按需使用「繁转简」或「生成加速 EXE」即可。

配置与日志写入**工具自身所在目录**（`speed_config.txt` / `SPEED_LOG.txt`）。

## 实现原理

游戏引擎的脚本加载是「jbin 字节码优先 → 明文 JS 回退」。patcher 把 EXE 内嵌启动包里 **4 个架构的 `init.jbin`** 全部置空，引擎于是回退加载我们注入的明文 JS——而这些 JS 与游戏脚本共享同一个 V8 上下文，所以能在运行时改写游戏行为。

**注入三步**

1. **取包** — EXE 的 PE 资源 `type=242 / name=241`（57.17 MB），逐字节 XOR `0x5A` → 解出一个 ZIP「pre 启动包」
2. **换芯** — 两件事：
   - **清空 4 个字节码缓存**（条目保留、内容置 0）：`pre/bin/arm/init.jbin`、`pre/bin/arm64/init.jbin`、`pre/bin/arm64l/init.jbin`、`pre/bin/x86_64/init.jbin`
   - **写入 17 个明文 JS**：来源是工具目录的 `embedded_javascript/`，落点是 ZIP 内 `pre/javascript/`（原版 ZIP 里本来没有这个目录）
3. **定长重建** — 差值用 ZIP comment / `pre/dummy_padding.bin` 吸收，产物与原 EXE 字节数完全相同 → 写回

**汉化（ssra 繁转简）**

`manifest.ssra` 记录文件在分卷组中的位置；`.ssrc` 分卷为 zstd 帧 + 16B footer（`SSRC`/卷号/XXH64）；`text.db` 为 PLPcK v1 容器，存储态带 256B 内层 XOR（相位逐文件固定）。转换后用标准 zstd skippable frame 垫帧，保证重建分卷与官方**逐字节同尺寸**（CDN 按尺寸发 Range 请求，尺寸不一致会导致 416 死循环），并同步 `manifest.ssra.etag` 身份记录。

## 构建

```bash
pip install -r requirements.txt
build.bat          # 输出 dist/ChaosZero-Toolkit.exe
```

直接运行源码：`python chaoszero_toolkit_gui.py`

一键构建发布：`python make_release.py build|publish`

## 目录

| 路径 | 说明 |
|---|---|
| `chaoszero_toolkit_gui.py` | GUI 主程序 |
| `embedded_javascript/` | 17 个内嵌脚本（`init.js` 为变速核心） |
| `embedded_bundle_patcher.py` | 加速 EXE 注入核心 |
| `ssra_zhcn.py` | ssra 繁转简核心（含 CLI） |
| `unpack_data.py` · `rebuild_bundle.py` | data.pack 解包 / bundle.pack 重建（独立命令行工具） |

## 许可

GPLv3 —— 详见 [LICENSE](LICENSE)。仅供个人研究使用，请自行遵守游戏服务条款。
