# ChaosZeroNightmare-Toolkit-Extra

卡厄斯梦境（Chaos Zero Nightmare）汉化与游戏内变速工具，社区维护版。

> 请支持原作者：[NineS11942 / ChaosZero-Toolkit](https://github.com/NineS11942/ChaosZero-Toolkit)

## 功能

- **繁转简**：一键把游戏官方繁体中文转为简体并应用，原文件自动备份、可随时还原
- **变速齿轮**：`F9` 加速（2x/3x/5x）· `F10` 复位 1x · `F11` 跳过动画 · `F12` 显隐 UI · `F8` 强制回主界面
- **状态记忆**：倍速与动画跳过自动记忆，重启游戏后自动恢复
- **管理员助手**：未以管理员运行时，执行操作前会提醒，并可一键提权重启
- 按键与行为可在 `speed_config.txt` 自定义；游戏更新后重新生成补丁即可适配

## 使用

1. 从 [Releases](../../releases) 下载压缩包，解压到游戏目录 `ChaosZeroNightmare` 所在目录
2. 运行 `ChaosZero-Toolkit.exe`，工具会自动定位游戏目录
3. 「繁转简」：构建完成后选择应用，启动游戏即见简体中文
4. 「生成加速 EXE」：生成后选择替换进游戏目录（原文件自动备份为 `.bak`），启动游戏生效

配置与日志在工具所在目录（`speed_config.txt` / `SPEED_LOG.txt`）。

## 原理

游戏引擎加载脚本是「jbin 字节码优先，明文 JS 回退」：工具把游戏 EXE 内嵌启动包中 4 个架构的 `init.jbin` 清空，注入自己的明文 JS 并定长重建（产物与原 EXE 字节数完全一致）。注入的 JS 与游戏共享同一运行时，因此能在游戏内实现变速、热键与界面功能。

繁转简直接处理游戏的 ssra 资源体系：提取官方繁中文本库，OpenCC 转简后重建数据分卷（与官方逐字节同尺寸，避免更新校验失败），并同步补丁器身份记录，使游戏 patching 正常通过。

## 构建

```bash
pip install -r requirements.txt
build.bat
```

产物为 `dist/ChaosZero-Toolkit.exe`。直接运行源码：`python chaoszero_toolkit_gui.py`

## 许可

GPLv3，详见 [LICENSE](LICENSE)。仅供个人研究使用，请自行遵守游戏服务条款。
