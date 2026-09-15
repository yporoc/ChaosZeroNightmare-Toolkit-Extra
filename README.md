# ChaosZeroNightmare-Toolkit-Extra

卡厄斯梦境（Chaos Zero Nightmare）汉化与游戏内变速工具，社区维护拓展版。

> 请支持原作者：[NineS11942 / ChaosZero-Toolkit](https://github.com/NineS11942/ChaosZero-Toolkit)

## 功能

### 原作者 V2.0 原有功能

- **汉化**：一键替换游戏文本库（繁体转简体）
- **变速齿轮**：`F9` 加速（2x/3x/5x）· `F10` 重置 1x · `F11` 动画跳过 · `F12` 显隐 UI
- 按键可在 `speed_config.txt` 自定义
- 直接补丁游戏 EXE 内嵌脚本，游戏更新后重新补丁原始 exe 自动适配

### 社区维护版新增功能

- **`F8` 强制回主界面**（复位 1x 并关闭动画跳过）：相当于无需代理的进程内重启。用于解决更新失败弹窗、各种出现 bug 的 UI 窗口无法交互甚至无法恢复的情况，免于开启代理或加速从 STOVE 重新启动游戏。
- **状态记忆**：倍速与动画跳过状态自动记忆——自动保存最后一次更改后的设置状态至 config，下次启动游戏后自动应用。只有 `F8` 强制重置和玩家手动更改会改变记忆状态。

## 使用

从 [Releases](../../releases) 下载压缩包，解压到游戏目录 `ChaosZeroNightmare` **所在的同一目录**，运行 `ChaosZero-Toolkit.exe`。按需对原 exe 和 `data.pack` 进行补丁和替换即可。

配置与日志写入**工具自身所在目录**（`speed_config.txt` / `SPEED_LOG.txt`）。

## 实现原理

游戏引擎的脚本加载是「jbin 字节码优先 → 明文 JS 回退」。patcher 把 EXE 内嵌启动包里 **4 个架构的 `init.jbin`** 全部置空，引擎于是回退加载我们注入的明文 JS——而这些 JS 与游戏脚本共享同一个 V8 上下文，所以能在运行时改写游戏行为。

**注入三步**

1. **取包** — EXE 的 PE 资源 `type=242 / name=241`（57.17 MB），逐字节 XOR `0x5A` → 解出一个 ZIP「pre 启动包」
2. **换芯** — 两件事：
   - **清空 4 个字节码缓存**（条目保留、内容置 0）：`pre/bin/arm/init.jbin`、`pre/bin/arm64/init.jbin`、`pre/bin/arm64l/init.jbin`、`pre/bin/x86_64/init.jbin`
   - **写入 17 个明文 JS**：来源是工具目录的 `embedded_javascript/`，落点是 ZIP 内 `pre/javascript/`（原版 ZIP 里本来没有这个目录）
3. **定长重建** — 差值用 ZIP comment / `pre/dummy_padding.bin` 吸收，产物与原 EXE 字节数完全相同 → 写回

**汉化**

解密 `data.pack`（PLPcK 容器：外层 XOR-129 循环密钥 LCG seed=150812，内层 256 字节仅作用于 `.db`）→ 取出 `text/ko/text.db` → 套 TSV 翻译 → 重建写回。

## 构建

```bash
pip install -r requirements.txt
build.bat          # 输出 dist/ChaosZero-Toolkit.exe
```

直接运行源码：`python chaoszero_toolkit_gui.py`

## 目录

| 路径 | 说明 |
|---|---|
| `chaoszero_toolkit_gui.py` | GUI 主程序 |
| `embedded_javascript/` | 17 个内嵌脚本（`init.js` 为变速核心） |
| `rebuild_ko_to_zht.py` · `rebuild_bundle.py` · `unpack_data.py` | 汉化重建 / 封包 / 解包 |
| `text_ko_text.tsv` · `text_zht_text(纯繁转简).tsv` | 汉化文本库 |

## 许可

GPLv3 —— 详见 [LICENSE](LICENSE)。仅供个人研究使用，请自行遵守游戏服务条款。
