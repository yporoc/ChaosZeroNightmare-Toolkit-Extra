// ============================================================
// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// Build from modular sources in src/ directory.
// ============================================================



// --- Start of 00_timers.js ---
// =====================================================================
// [POLYFILL]
// =====================================================================
if (typeof globalThis === 'undefined') {
    (function() {
        if (typeof global !== 'undefined') {
            global.globalThis = global;
        } else if (typeof window !== 'undefined') {
            window.globalThis = window;
        } else if (typeof self !== 'undefined') {
            self.globalThis = self;
        } else {
            this.globalThis = this;
        }
    })();
}

// =====================================================================
// [V8 TIMERS HOOK] 修复"时间线割裂"问题
//   setTimeScale 仅加速 Cocos 引擎的 dt，但 V8 原生定时器
//   (setTimeout/setInterval) 依然以 1x 真实时钟运行。此 Hook 将定时器
//   延时除以当前加速倍率，使 JS 异步延时与引擎加速保持同步。
// =====================================================================
(function () {
    'use strict';
    try {
        if (globalThis._timersHooked) return;

        var origSetTimeout = globalThis.setTimeout;
        var origSetInterval = globalThis.setInterval;
        var origClearTimeout = globalThis.clearTimeout;
        var origClearInterval = globalThis.clearInterval;

        if (typeof origSetTimeout !== 'function') {
            console.log('[TIMERS HOOK] setTimeout not available, skipping.');
            return;
        }

        function _getDynamicSpeed() {
            try {
                if (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') {
                    var s = globalThis._SPEED_LEVELS[globalThis._speedIdx];
                    return (typeof s === 'number' && s > 0) ? s : 1;
                }
            } catch (e) { }
            return 1;
        }

        globalThis.setTimeout = function (handler, timeout) {
            var speed = _getDynamicSpeed();
            var scaledTimeout = (typeof timeout === 'number' && timeout > 0)
                ? Math.max(0, Math.round(timeout / speed))
                : timeout;
            var args = [];
            for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
            if (args.length > 0) {
                return origSetTimeout.call(this, handler, scaledTimeout, args[0], args[1], args[2], args[3]);
            }
            return origSetTimeout.call(this, handler, scaledTimeout);
        };

        globalThis.setInterval = function (handler, timeout) {
            var speed = _getDynamicSpeed();
            var scaledTimeout = (typeof timeout === 'number' && timeout > 0)
                ? Math.max(1, Math.round(timeout / speed))
                : timeout;
            var args = [];
            for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
            if (args.length > 0) {
                return origSetInterval.call(this, handler, scaledTimeout, args[0], args[1], args[2], args[3]);
            }
            return origSetInterval.call(this, handler, scaledTimeout);
        };

        if (typeof origClearTimeout === 'function') globalThis.clearTimeout = origClearTimeout;
        if (typeof origClearInterval === 'function') globalThis.clearInterval = origClearInterval;

        globalThis._timersHooked = true;
        globalThis._origSetTimeout = origSetTimeout;
        globalThis._origSetInterval = origSetInterval;

        console.log('[TIMERS HOOK] setTimeout/setInterval globally hooked for speed sync.');
    } catch (e) {
        console.log('[TIMERS HOOK] Hook failed: ' + e);
    }
})();
// --- End of 00_timers.js ---


// --- Start of 01_header.js ---
'use strict';

// [已清理] require/ModuleLoader 拦截器已移除（方案3已废弃，BEM无法通过此方式获取）

Object.defineProperty(exports, '__esModule', { value: true });
// --- End of 01_header.js ---


// --- Start of 02_boot.js ---
// 함수 실행 시간을 측정하는 유틸리티 함수
function measurePerformance(fn, functionName) {
    return function (...args) {
        const startTime = Date.now();
        const result = fn.apply(this, args);

        // Promise인 경우 (async 함수)
        if (result && typeof result.then === 'function') {
            return result.then((res) => {
                const executionTime = Date.now() - startTime;
                if (executionTime > 100) {
                    console.log(`${functionName}() took ${executionTime}ms (over 0.1 second)`);
                }
                return res;
            }).catch((err) => {
                const executionTime = Date.now() - startTime;
                if (executionTime > 100) {
                    console.log(`${functionName}() took ${executionTime}ms (over 0.1 second) - failed with error: ${err}`);
                }
                throw err;
            });
        } else {
            // 일반 함수
            const executionTime = Date.now() - startTime;
            if (executionTime > 100) {
                console.log(`${functionName}() took ${executionTime}ms (over 0.1 second)`);
            }
            return result;
        }
    };
}


require('./boot.js')
const bootres = require('./bootres.js')
const bgani = require('./bgani.js')
const title = require('./title.js')
const { TitleXcentNoticePopup } = require('./title_popups.js')
const { PreTexts } = require('./pre_data.js')
const { Util } = require('./util.js')
const { EntryUtil } = require('./entry_util.js')
const { ResolutionHandler } = require('./resolution.js');

global.pre = {}

var TitleScenePre = new title.TitleScenePre()
global.TitleScenePre = TitleScenePre

if (_getenv('xcent.notice', 0)) {
    var TitleXcentNotice = new TitleXcentNoticePopup()
}

/**
 * 시작 절차
 * 1. (_application_start_contents) 엔진에서 호출되어 시작됩니다.
 * 2. (_display_logo) CI를 보여줍니다.
 * 3. (_async_load_version_info) 엔트리서버 쿼리를 진행합니다.
 * 4. (_show_app_upgrade) 앱업데이트 메시지를 표시합니다.
 * 5. (_start_title_scene) 엔트리서버 결과를 정상적으로 받아오면 타이틀 씬을 실행합니다.
 * 6. (_start_patch) 사전다운로드가 필요하다면 해당 버전에 맞게 패치정보 세팅 후 패치를 진행합니다.
 * 7. (_show_maintenance) 만약 점검중이라면 점검 레이어를 표시합니다.
 * 8. (_start_patch) 패치를 진행합니다.
 * 9. (_load_application_resources) 패치가 완료되면 제어를 script 단으로 넘깁니다.
 */

cc.Device.setKeepScreenOn(true);

var xcent_notice_list_before_patch = []
var xcent_notice_list_after_patch = []

const _original_process_next_notice = function () {
    if (xcent_notice_list_before_patch.length > 0) {
        const nextNotice = xcent_notice_list_before_patch[0];
        console.log('nextNotice : ', JSON.stringify(nextNotice))

        TitleXcentNotice.createScene(function () {
            check_xcent_notice()
        })
        TitleXcentNotice.setNotice(nextNotice.notice_text_obj.notice_title, nextNotice.notice_text_obj.notice_content);

        const target_layer = TitleScenePre.getTargetLayer();
        TitleXcentNotice.show(target_layer)
    } else {
        TitleScenePre.startPatch()
    }
};
const process_next_notice = measurePerformance(_original_process_next_notice, 'process_next_notice');

const _original_check_xcent_notice = function () {
    console.log('check_xcent_notice', xcent_notice_list_before_patch.length)
    if (xcent_notice_list_before_patch.length > 0) {
        xcent_notice_list_before_patch.shift();
    }
    process_next_notice();
};
const check_xcent_notice = measurePerformance(_original_check_xcent_notice, 'check_xcent_notice');

// 네이티브에서 호출됨.(중국 공지 데이터)
function _original_OnXcentLoadNoticeData(result) {
    const parsedData = JSON.parse(result);

    // notice_type 으로 보여 주는 타이밍이 다름
    if (parsedData.notice_list) {
        xcent_notice_list_before_patch = parsedData.notice_list.filter(function (notice) { return notice.notice_type === 1008 });
        xcent_notice_list_after_patch = parsedData.notice_list.filter(function (notice) { return notice.notice_type === 1010 });
    }

    console.log('xcent_notice_list_before_patch : ', xcent_notice_list_before_patch.length)
    console.log('xcent_notice_list_after_patch : ', xcent_notice_list_after_patch.length)

    if (xcent_notice_list_before_patch.length > 0) {
        xcent_notice_list_before_patch.sort(function (a, b) { return a.order - b.order });
    }
    if (xcent_notice_list_after_patch.length > 0) {
        xcent_notice_list_after_patch.sort(function (a, b) { return a.order - b.order });
    }
    process_next_notice();
}

const OnXcentLoadNoticeData = measurePerformance(_original_OnXcentLoadNoticeData, 'OnXcentLoadNoticeData');
global.OnXcentLoadNoticeData = OnXcentLoadNoticeData;

function _original_process_next_notice_after_patch() {
    console.log("process_next_notice_after_patch")
    if (xcent_notice_list_after_patch.length > 0) {
        console.log("xcent_notice_list_after_patch.length > 0");
        const nextNotice = xcent_notice_list_after_patch[0];
        console.log('nextNotice after patch : ', JSON.stringify(nextNotice))

        TitleXcentNotice.createScene(function () {
            check_after_patch_notice()
        })
        TitleXcentNotice.setNotice(nextNotice.notice_text_obj.notice_title, nextNotice.notice_text_obj.notice_content);

        const target_layer = TitleScenePre.getTargetLayer();
        TitleXcentNotice.show(target_layer)
    } else {
        console.log("xcent_notice_list_after_patch.length === 0");
        TitleScenePre.onAfterPatch();
    }
}

const process_next_notice_after_patch = measurePerformance(_original_process_next_notice_after_patch, 'process_next_notice_after_patch');

function _original_check_after_patch_notice() {
    console.log('check_after_patch_notice', xcent_notice_list_after_patch.length)
    if (xcent_notice_list_after_patch.length > 0) {
        xcent_notice_list_after_patch.shift();
    }
    process_next_notice_after_patch();
}

const check_after_patch_notice = measurePerformance(_original_check_after_patch_notice, 'check_after_patch_notice');

var first_notice_after_patch = true
var is_waiting_for_user_action = false
// --- End of 02_boot.js ---


// --- Start of 03_framework.js ---
// --- [MODULE START] 05_framework.js ---
/**
 * Plugin Framework
 * Implements Service Locator and Observer Pattern.
 */
globalThis.__app = {
    services: {},
    events: {},
    pages: [],

    // Service Locator
    registerService: function(name, service) {
        this.services[name] = service;
        if (typeof globalThis._speedLog === 'function') globalThis._speedLog('[App] Service Registered: ' + name);
    },
    getService: function(name) {
        return this.services[name];
    },

    // Event Bus (Observer Pattern)
    on: function(event, handler) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(handler);
    },
    emit: function(event, data) {
        if (this.events[event]) {
            for (var i = 0; i < this.events[event].length; i++) {
                try {
                    this.events[event][i](data);
                } catch (e) {
                    if (typeof globalThis._speedLog === 'function') globalThis._speedLog('[App] Event Error (' + event + '): ' + e);
                }
            }
        }
    },

    // Plugin Architecture: Register UI tabs
    registerPage: function(title, uiBuilder) {
        this.pages.push({ title: title, builder: uiBuilder });
        if (typeof globalThis._speedLog === 'function') globalThis._speedLog('[App] Page Registered: ' + title);
    }
};
// --- [MODULE END] 05_framework.js ---

// --- End of 03_framework.js ---


// --- Start of 04_logger_config.js ---
// --- [MODULE START] 06_logger_config.js ---
(function() {
    var _speedLogPath = '';
    var _speedLogBuf = [];
    var _speedLogPathAlt = '';

    var _logCleared = false;

    // [工具箱目录解析] 候选顺序：patcher 注入的工具箱目录 → 引擎可写目录。
    //   官方 GUI 构建时注入的是「工具自身所在目录」（toolkit_dir=EXE_DIR），
    //   故分发到任意机器都会落到该用户自己的工具箱目录；注入路径不可写时自动回退，
    //   不再依赖任何硬编码绝对路径。
    function _toolkitDirCandidates() {
        var cands = [];
        var injected = '__TOOLKIT_DIR__';
        if (injected.indexOf('__') !== 0) cands.push(injected);
        try {
            var w = cc.FileUtils.getInstance().getWritablePath();
            if (w) cands.push(w);
        } catch (e) { }
        var out = [];
        for (var i = 0; i < cands.length; i++) {
            var d = String(cands[i]).replace(/\\/g, '/');
            if (d && d.charAt(d.length - 1) !== '/') d += '/';
            if (d) out.push(d);
        }
        return out;
    }

    // 返回第一个「确实可写」的目录（写入后回读校验；已存在的文件绝不覆写）
    function _pickWritableToolkitDir(probeName) {
        var cands = _toolkitDirCandidates();
        for (var i = 0; i < cands.length; i++) {
            try {
                var p = cands[i] + probeName;
                if (!cc.FileUtils.getInstance().isFileExist(p)) {
                    cc.FileUtils.getInstance().writeStringToFile('', p);
                }
                if (cc.FileUtils.getInstance().isFileExist(p)) return cands[i];
            } catch (e) { }
        }
        return '';
    }

    function _initSpeedLogPath() {
        if (!_logCleared) {
            _logCleared = true;
            _speedLogBuf.unshift('=== NEW SESSION STARTED ===');
        }
        if (_speedLogPath) return;
        var dir = _pickWritableToolkitDir('SPEED_LOG.txt');
        _speedLogPath = dir ? dir + 'SPEED_LOG.txt' : 'SPEED_LOG.txt';
    }

    globalThis._speedLog = function(msg) {
        var line = Date.now() + ' | [SpeedHack] ' + msg;
        console.log(line);
        _speedLogBuf.push(line);
        var content = _speedLogBuf.join('\n') + '\n';
        try {
            _initSpeedLogPath();
            cc.FileUtils.getInstance().writeStringToFile(content, _speedLogPath);
        } catch (e) { }
    };

    globalThis._SPEED_LEVELS = [1, 2, 3, 5];
    globalThis._speedIdx = 1;

    var ConfigService = {
        _cfgKeySpeed: [55],
        _cfgKeyReset: [56],
        _cfgKeySkip: [57],
        _cfgKeyHideUI: [58],
        _cfgKeyHome: [54],
        _cfgDefaultSpeedIdx: 1,
        _cfgLastSpeed: 0,
        _cfgLastSkip: false,
        _cfgConfigPath: '',
        _btnPosX: 60,
        _btnPosY: 100,

        getConfigPath: function() {
            if (this._cfgConfigPath) return this._cfgConfigPath;
            // [工具箱目录解析] 同日志：注入的工具箱目录优先，不可写则回退引擎可写目录
            var dir = _pickWritableToolkitDir('speed_config.txt');
            return (this._cfgConfigPath = dir ? dir + 'speed_config.txt' : 'speed_config.txt');
        },

        _parseKeyList: function(val) {
            var parts = String(val).split(',');
            var result = [];
            for (var i = 0; i < parts.length; i++) {
                var n = parseInt(parts[i].trim(), 10);
                if (!isNaN(n)) result.push(n);
            }
            return result.length > 0 ? result : null;
        },

        _writeDefaultConfig: function(cfgPath) {
            try {
                var txt = [
                    '# === SpeedHack 配置文件 ===',
                    '# Cocos2d-x 底层真实键码 (F键区): F8=54, F9=55, F10=56, F11=57, F12=58',
                    'key_speed=55',
                    'key_reset=56',
                    'key_skip=57',
                    'key_hide_ui=58',
                    '# 强制回主界面(重启内容层回标题): F8=54',
                    'key_home=54',
                    '# 首次按加速键的默认速度档位 (1=2x, 2=3x, 3=5x)',
                    '# 设为3可首次按键直接跳到5x',
                    'default_speed=1',
                    '# 上次倍速状态（自动写入，重启游戏自动恢复；0=不记忆）',
                    'last_speed=0',
                    '# 上次动画跳过状态（自动写入，重启游戏自动恢复；0=关 1=开）',
                    'last_skip=0',
                    'btn_x=60',
                    'btn_y=100',
                    ''
                ].join('\n');
                cc.FileUtils.getInstance().writeStringToFile(txt, cfgPath);
                globalThis._speedLog('[CONFIG] Default config written to: ' + cfgPath);
            } catch (e) {
                globalThis._speedLog('[CONFIG] Write default error: ' + e);
            }
        },

        load: function() {
            try {
                var cfgPath = this.getConfigPath();
                if (!cc.FileUtils.getInstance().isFileExist(cfgPath)) {
                    this._writeDefaultConfig(cfgPath);
                    return;
                }
                var content = cc.FileUtils.getInstance().getStringFromFile(cfgPath);
                if (!content || content.length < 5) {
                    this._writeDefaultConfig(cfgPath);
                    return;
                }
                var lines = content.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (!line || line.charAt(0) === '#') continue;
                    var eqIdx = line.indexOf('=');
                    if (eqIdx < 0) continue;
                    var key = line.substring(0, eqIdx).trim().toLowerCase();
                    var val = line.substring(eqIdx + 1).trim();

                    if (key === 'key_speed') { var k = this._parseKeyList(val); if (k) this._cfgKeySpeed = k; }
                    else if (key === 'key_reset') { var k = this._parseKeyList(val); if (k) this._cfgKeyReset = k; }
                    else if (key === 'key_skip') { var k = this._parseKeyList(val); if (k) this._cfgKeySkip = k; }
                    else if (key === 'key_hide_ui') { var k = this._parseKeyList(val); if (k) this._cfgKeyHideUI = k; }
                    else if (key === 'key_home') { var k = this._parseKeyList(val); if (k) this._cfgKeyHome = k; }
                    else if (key === 'default_speed') {
                        var idx = parseInt(val, 10);
                        if (!isNaN(idx)) this._cfgDefaultSpeedIdx = idx;
                    }
                    else if (key === 'last_speed') {
                        var lastVal = parseFloat(val);
                        if (!isNaN(lastVal) && lastVal >= 0) this._cfgLastSpeed = lastVal;
                    }
                    else if (key === 'last_skip') {
                        this._cfgLastSkip = (val === '1' || val.toLowerCase() === 'true');
                    }
                    else if (key === 'btn_x') { var n = parseInt(val, 10); if (!isNaN(n)) globalThis._btnPosX = n; }
                    else if (key === 'btn_y') { var n = parseInt(val, 10); if (!isNaN(n)) globalThis._btnPosY = n; }
                }
                globalThis._speedLog('[CONFIG] Loaded: speed=' + this._cfgKeySpeed + ' reset=' + this._cfgKeyReset + ' skip=' + this._cfgKeySkip + ' home=' + this._cfgKeyHome + ' last=' + this._cfgLastSpeed + ' last_skip=' + this._cfgLastSkip);
                __app.emit('configLoaded', this);
            } catch (e) {
                globalThis._speedLog('[CONFIG] Load error: ' + e);
            }
        },

        // ═══════════════════════════════════════════════════════════════
        // [状态持久化] save(key, value) — 读-改-写指定键所在行
        //   只替换/追加一行，其余行（含用户注释）原样保留；
        //   任何失败只记日志，不影响游戏运行
        // ═══════════════════════════════════════════════════════════════
        save: function(key, value) {
            try {
                var cfgPath = this.getConfigPath();
                var raw = cc.FileUtils.getInstance().getStringFromFile(cfgPath) || '';
                var lines = raw.split('\n');
                var prefix = key + '=';
                var found = false;
                for (var i = 0; i < lines.length; i++) {
                    var t = lines[i].trim();
                    if (t && t.charAt(0) !== '#' && t.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                        lines[i] = key + '=' + value;
                        found = true;
                        break;
                    }
                }
                if (!found) lines.push(key + '=' + value);
                var content = lines.join('\n');
                if (content.charAt(content.length - 1) !== '\n') content += '\n';
                cc.FileUtils.getInstance().writeStringToFile(content, cfgPath);
                globalThis._speedLog('[PERSIST] Saved ' + key + '=' + value + ' → ' + cfgPath);
            } catch (e) {
                globalThis._speedLog('[PERSIST] Save error (' + key + '): ' + e);
            }
        }
    };

    __app.registerService('ConfigService', ConfigService);
    
    // Provide global access for UI module
    globalThis._btnPosX = 60;
    globalThis._btnPosY = 100;
    globalThis._loadSpeedConfig = function() { ConfigService.load(); };
    globalThis._saveSpeedState = function(key, value) { ConfigService.save(key, value); };
    
    // Auto load on init
    ConfigService.load();

})();
// --- [MODULE END] 06_logger_config.js ---

// --- End of 04_logger_config.js ---


// --- Start of 05_keep_alive.js ---
// --- [MODULE START] 05_keep_alive.js ---
(function() {
    var KeepAliveService = {
        _keepAliveRunning: false,
        _keepAliveCounts: { A: 0 },
        _lastKeepAliveWallTime: 0,

        _doKeepAliveTick: function(source) {
            var wallNow = Date.now();
            if (wallNow - this._lastKeepAliveWallTime < 10000) return;
            this._lastKeepAliveWallTime = wallNow;

            var src = source || '?';
            if (this._keepAliveCounts[src] !== undefined) this._keepAliveCounts[src]++;

            try {
                // Fetch states from services/globals
                var sparkGuardActive = globalThis._sparkGuardActive || false;
                if (sparkGuardActive) {
                    globalThis._speedLog('[Keep-Alive][' + src + '] Skipped (spark guard active)');
                    return;
                }

                var config = __app.getService('ConfigService');
                var speedLevel = 1;
                var speedIdx = globalThis._speedIdx || 0;
                if (config && globalThis._SPEED_LEVELS) {
                    speedLevel = globalThis._SPEED_LEVELS[speedIdx] || 1;
                } else if (globalThis._SPEED_LEVELS) {
                    speedLevel = globalThis._SPEED_LEVELS[speedIdx] || 1;
                }

                var animSkipEnabled = globalThis._animSkipEnabled || false;

                if (speedLevel > 1 || animSkipEnabled) {
                    globalThis._speedLog('[Keep-Alive][' + src + '] tick #' + this._keepAliveCounts[src] + '. Speed=' + speedLevel + 'x Skip=' + animSkipEnabled);
                }

                if (speedLevel && speedLevel > 1) {
                    if (typeof globalThis._applySpeed === 'function') globalThis._applySpeed(speedLevel);
                    if (typeof globalThis._ensureGuardsInstalled === 'function') _ensureGuardsInstalled();
                }

                if (animSkipEnabled) {
                    var animSkipService = __app.getService('AnimSkipService');
                    if (animSkipService) animSkipService.refreshHooks();
                    else {
                        // Fallback to globals
                        if (typeof globalThis._hookDelayTime === 'function') _hookDelayTime();
                        if (typeof globalThis._hookFadeAnimations === 'function') _hookFadeAnimations();
                        try { if (typeof globalThis._hookTimeSleep === 'function') _hookTimeSleep(); } catch (e) { }
                        if (typeof globalThis._hookEntityPlayAnimation === 'function') _hookEntityPlayAnimation(true);
                    }
                }
            } catch (e) {
                globalThis._speedLog('[Keep-Alive][' + src + '] tick error: ' + e);
            }
        },

        startGlobalKeepAlive: function(targetNode) {
            if (this._keepAliveRunning) return;
            if (!targetNode) return;

            var apis = [];
            apis.push('DelayTime=' + (typeof cc.DelayTime));
            apis.push('CallFunc=' + (typeof cc.CallFunc));
            apis.push('Sequence=' + (typeof cc.Sequence));
            apis.push('RepeatForever=' + (typeof cc.RepeatForever));
            apis.push('Repeat=' + (typeof cc.Repeat));
            globalThis._speedLog('[Keep-Alive] Action API probe: ' + apis.join(', '));

            try {
                var delay = cc.DelayTime.create(15);
                var callFunc = null;
                if (typeof cc.CallFunc !== 'undefined' && typeof cc.CallFunc.create === 'function') {
                    var self = this;
                    callFunc = cc.CallFunc.create(function () {
                        self._doKeepAliveTick('A');
                    });
                }
                if (!callFunc) {
                    globalThis._speedLog('[Keep-Alive] CallFunc not available, aborting');
                    return;
                }

                var seq = null;
                if (typeof cc.Sequence !== 'undefined' && typeof cc.Sequence.create === 'function') {
                    seq = cc.Sequence.create(delay, callFunc);
                }
                if (!seq) return;

                var forever = null;
                if (typeof cc.RepeatForever !== 'undefined' && typeof cc.RepeatForever.create === 'function') {
                    forever = cc.RepeatForever.create(seq);
                } else if (typeof cc.Repeat !== 'undefined' && typeof cc.Repeat.create === 'function') {
                    forever = cc.Repeat.create(seq, 999999);
                }
                if (!forever) return;

                targetNode.runAction(forever);
                this._keepAliveRunning = true;
                globalThis._speedLog('[Keep-Alive] SUCCESS: Action running on node. 15s cycle active.');
            } catch (e) {
                globalThis._speedLog('[Keep-Alive] Action setup FAILED: ' + e);
            }
        }
    };

    __app.registerService('KeepAliveService', KeepAliveService);
    
    // Also expose global fallback if needed by other legacy code
    globalThis._startGlobalKeepAlive = function(node) {
        KeepAliveService.startGlobalKeepAlive(node);
    };
})();
// --- [MODULE END] 05_keep_alive.js ---
// --- End of 05_keep_alive.js ---


// --- Start of 06_spark_guard.js ---
// --- [MODULE START] 06_spark_guard.js ---
(function() {
    var SparkGuardService = {
        _sparkGuardActive: false,
        _sparkGuardInstalled: false,

        install: function() {
            if (this._sparkGuardInstalled) return;
            try {
                var BH = globalThis.BattleHelper;
                if (!BH) {
                    globalThis._speedLog('[SPARK GUARD] BattleHelper not found — will retry later');
                    return;
                }
                if (!BH.battle_stage) {
                    globalThis._speedLog('[SPARK GUARD] BattleHelper.battle_stage is null — wait for combat');
                    return;
                }
                this._sparkGuardInstalled = true;
                globalThis._sparkGuardInstalled = true;
                globalThis._speedLog('[SPARK GUARD] ═══ Installation complete ═══');
            } catch (e) {
                globalThis._speedLog('[SPARK GUARD] Install error: ' + e);
            }
        },

        installComprehensive: function() {
            if (globalThis._comprehensiveSparkGuardInstalled && globalThis._comprehensiveSparkGuardPhase4Done) return;
            if (!globalThis._comprehensiveSparkGuardInstalled) {
                globalThis._speedLog('[SPARK V20] 安装方案 4 + 黑科技 7...');
                globalThis._comprehensiveSparkGuardInstalled = true;
            }

            try {
                function _findClass(className) {
                    var Cls = null;
                    if (typeof globalThis[className] !== 'undefined') Cls = globalThis[className];
                    else if (typeof window !== 'undefined' && window[className]) Cls = window[className];
                    if (!Cls && typeof require !== 'undefined') {
                        try { Cls = require(className); } catch(e) {}
                        if (!Cls) try { Cls = require('game/' + className.toLowerCase().replace(/ui$/, '_ui').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')); } catch(e) {}
                        if (!Cls) try { Cls = require('game_ui/ingame/deck/' + className.toLowerCase().replace(/ui$/, '_ui').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')); } catch(e) {}
                    }
                    if (!Cls && typeof cc !== 'undefined' && cc.js && cc.js.getClassByName) {
                        try { Cls = cc.js.getClassByName(className); } catch(e) {}
                    }
                    if (Cls && Cls[className]) Cls = Cls[className];
                    return Cls;
                }

                if (!globalThis._rsparkManagerHooked) {
                    var RM = _findClass('RSparkManager');
                    if (RM && typeof RM.createRSparkSelectPopup === 'function' && !RM._v20hook_createRSparkSelectPopup) {
                        var origRM = RM.createRSparkSelectPopup;
                        var self = this;
                        RM.createRSparkSelectPopup = function () {
                            globalThis._speedLog('[SPARK V20] 🛡️ 方案4 拦截: createRSparkSelectPopup 进入 → 强制 1x 保护');
                            globalThis._rsparkSelectActive = true;
                            self._sparkGuardActive = true;
                            globalThis._sparkGuardActive = true;
                            
                            var sg = __app.getService('SparkGuardService');
                            if (sg) sg.installRSparkUpdateHook();

                            try {
                                cc.Director.getInstance().getScheduler().setTimeScale(1);
                                var dir = cc.Director.getInstance();
                                if (typeof dir.getSchedulerByIndex === 'function') {
                                    for (var si = 0; si < 5; si++) {
                                        try { var s = dir.getSchedulerByIndex(si); if (s && typeof s.setTimeScale === 'function') s.setTimeScale(1); } catch (e) { }
                                    }
                                }
                                if (typeof yuna !== 'undefined' && yuna.setenv) yuna.setenv('time_scale', 1);
                            } catch (e) { globalThis._speedLog('[SPARK V20] 方案4 降速失败: ' + e); }

                            var result = origRM.apply(this, arguments);

                            try {
                                var scene = cc.Director.getInstance().getRunningScene();
                                if (scene) {
                                    var delay = cc.DelayTime.create(3);
                                    var restore = cc.CallFunc.create(function () {
                                        var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                        globalThis._speedLog('[SPARK V20] 🚀 createRSparkSelectPopup 3秒延时结束 → 恢复 ' + curSpeed + 'x 加速');
                                        globalThis._rsparkSelectActive = false;
                                        self._sparkGuardActive = false;
                                        globalThis._sparkGuardActive = false;
                                        if (curSpeed > 1 && typeof globalThis._applySpeed === 'function') {
                                            globalThis._applySpeed(curSpeed);
                                        }
                                    });
                                    scene.runAction(cc.Sequence.create(delay, restore));
                                }
                            } catch (e) { globalThis._speedLog('[SPARK V20] ⚠️ 延时恢复安装失败: ' + e); }

                            return result;
                        };
                        RM._v20hook_createRSparkSelectPopup = true;
                        globalThis._rsparkManagerHooked = true;
                        globalThis._speedLog('[SPARK V20] ✅ RSparkManager.createRSparkSelectPopup 延时防护 Hook 安装成功');
                    }
                }

                if (!globalThis._gameCardSelectUIHooked) {
                    var UI = _findClass('GameCardSelectUI');
                    if (UI) {
                        var methods = ['createUI', 'createNonbattleUI'];
                        var hookedCount = 0;
                        for (var i = 0; i < methods.length; i++) {
                            (function(mName) {
                                if (typeof UI[mName] === 'function' && !UI['_v20hook_' + mName]) {
                                    var origUI = UI[mName];
                                    UI[mName] = function() {
                                        globalThis._speedLog('[SPARK V20] 🎯 Layer 6 信号激活: ' + mName + ' → globalThis._rsparkSelectActive = true');
                                        globalThis._rsparkSelectActive = true;
                                        return origUI.apply(this, arguments);
                                    };
                                    UI['_v20hook_' + mName] = true;
                                    hookedCount++;
                                }
                            })(methods[i]);
                        }
                        if (hookedCount > 0) {
                            globalThis._gameCardSelectUIHooked = true;
                            globalThis._speedLog('[SPARK V20] ✅ GameCardSelectUI 选牌全局信号 Hook 安装成功');
                        }
                    }
                }

                if (globalThis._rsparkManagerHooked || globalThis._gameCardSelectUIHooked) {
                    globalThis._comprehensiveSparkGuardPhase4Done = true;
                }
            } catch (e) {
                globalThis._speedLog('[SPARK V20] 方案 4 安装失败: ' + e);
            }

            try {
                if (typeof Map !== 'undefined' && Map.prototype.set && !Map.prototype._v20_hooked) {
                    var origMapSet = Map.prototype.set;
                    var selfMap = this;
                    Map.prototype.set = function (k, v) {
                        if (k === 'ON_SPARK_START' || k === 'ON_SPARK_END' || (typeof k === 'string' && k.indexOf('SPARK') !== -1)) {
                            globalThis._speedLog('[SPARK V20] 🔮 黑科技 7 (Map.set) 捕获对 ' + k + ' 的注册');
                            var wrapListenerObj = function (item, key) {
                                if (typeof item === 'function' && !item._v20_hooked) {
                                    var origCb = item;
                                    var newCb = function () {
                                        globalThis._speedLog('[SPARK V20] 🚀 Map Listener(Func) 触发了! 事件: ' + key);
                                        if (key === 'ON_SPARK_START') { 
                                            selfMap._sparkGuardActive = true; 
                                            globalThis._sparkGuardActive = true; 
                                            try { cc.Director.getInstance().getScheduler().setTimeScale(1); if (typeof yuna !== 'undefined' && yuna.setenv) yuna.setenv('time_scale', 1); } catch (e) { } 
                                        } else if (key === 'ON_SPARK_END') { 
                                            selfMap._sparkGuardActive = false; 
                                            globalThis._sparkGuardActive = false; 
                                            var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                            if (curSpeed > 1 && typeof globalThis._applySpeed === 'function') globalThis._applySpeed(curSpeed); 
                                        }
                                        return origCb.apply(this, arguments);
                                    };
                                    newCb._v20_hooked = true;
                                    return newCb;
                                } else if (item && typeof item === 'object') {
                                    var targetProp = null;
                                    if (typeof item.callback === 'function') targetProp = 'callback';
                                    else if (typeof item.handler === 'function') targetProp = 'handler';
                                    else if (typeof item.cb === 'function') targetProp = 'cb';

                                    if (targetProp && !item[targetProp]._v20_hooked) {
                                        var origCb2 = item[targetProp];
                                        item[targetProp] = function () {
                                            globalThis._speedLog('[SPARK V20] 🚀 Map Listener(' + targetProp + ') 触发了! 事件: ' + key);
                                            if (key === 'ON_SPARK_START') { 
                                                selfMap._sparkGuardActive = true; 
                                                globalThis._sparkGuardActive = true; 
                                                try { cc.Director.getInstance().getScheduler().setTimeScale(1); if (typeof yuna !== 'undefined' && yuna.setenv) yuna.setenv('time_scale', 1); } catch (e) { } 
                                            } else if (key === 'ON_SPARK_END') { 
                                                selfMap._sparkGuardActive = false; 
                                                globalThis._sparkGuardActive = false; 
                                                var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                                if (curSpeed > 1 && typeof globalThis._applySpeed === 'function') globalThis._applySpeed(curSpeed); 
                                            }
                                            return origCb2.apply(this, arguments);
                                        };
                                        item[targetProp]._v20_hooked = true;
                                    }
                                    return item;
                                }
                                return item;
                            };

                            if (Array.isArray(v)) {
                                for (var i = 0; i < v.length; i++) v[i] = wrapListenerObj(v[i], k);
                                if (!v._v20_push_hooked) {
                                    var origPush = v.push;
                                    v.push = function (item) { return origPush.call(this, wrapListenerObj(item, k)); };
                                    v._v20_push_hooked = true;
                                }
                            } else {
                                v = wrapListenerObj(v, k);
                            }
                        }
                        return origMapSet.call(this, k, v);
                    };
                    Map.prototype._v20_hooked = true;
                    var origMapGet = Map.prototype.get;
                    Map.prototype.get = function (k) {
                        if (k === 'ON_SPARK_START') globalThis._speedLog('[SPARK V20] 👁️ Map.get ON_SPARK_START');
                        return origMapGet.apply(this, arguments);
                    };
                    globalThis._speedLog('[SPARK V20] ✅ 黑科技 7 (Map 原型拦截升级版) 安装成功');
                }
            } catch (e) { globalThis._speedLog('[SPARK V20] 黑科技 7 安装失败: ' + e); }
        },

        installRSparkUpdateHook: function() {
            if (globalThis._rsparkUpdateHooked) return;
            var hookedMethods = [];
            function _applyInstancePropertyHook(instance) {
                try {
                    if (instance.hasOwnProperty('press_time')) {
                        var actualPress = instance.press_time || 0;
                        Object.defineProperty(instance, 'press_time', {
                            get: function() { return actualPress; },
                            set: function(newVal) {
                                var oldVal = actualPress;
                                if (newVal > oldVal && (newVal - oldVal) < 1.0) {
                                    var dt = newVal - oldVal;
                                    var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                    if (curSpeed > 1 && dt > 0.030) dt = dt / curSpeed;
                                    actualPress = oldVal + dt;
                                } else {
                                    actualPress = newVal;
                                }
                            },
                            configurable: true
                        });
                        globalThis._speedLog('[LAYER 5] 🪝 实例级属性劫持成功: press_time');
                    }
                } catch(e) { globalThis._speedLog('[LAYER 5] ⚠️ 实例级劫持异常: ' + e); }
            }

            try {
                if (!globalThis._v20_bind_hooked) {
                    var origBind = Function.prototype.bind;
                    Function.prototype.bind = function(thisArg) {
                        var boundFn = origBind.apply(this, arguments);
                        try {
                            if (thisArg && typeof thisArg === 'object') {
                                var ctorName = thisArg.constructor ? thisArg.constructor.name : '';
                                var isSpark = false;
                                if (this.name === 'update') {
                                    var lowerCtorName = ctorName.toLowerCase();
                                    if (lowerCtorName.indexOf('spark') !== -1 || lowerCtorName.indexOf('card') !== -1) isSpark = true;
                                }
                                if (thisArg.hasOwnProperty('limit_press_time') || thisArg.hasOwnProperty('press_time')) {
                                    isSpark = true;
                                    if (!thisArg._v20_prop_hacked_in_bind) {
                                        _applyInstancePropertyHook(thisArg);
                                        thisArg._v20_prop_hacked_in_bind = true;
                                    }
                                }
                                if (isSpark) {
                                    globalThis._speedLog('[LAYER 5] 🎯 捕获到底层 bind: ' + (ctorName || 'Unknown') + ' -> 强制防守');
                                    var wrappedBoundFn = function() {
                                        var args = Array.prototype.slice.call(arguments);
                                        var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                        if (curSpeed > 1) {
                                            for (var i = 0; i < args.length; i++) {
                                                if (typeof args[i] === 'number' && !isNaN(args[i])) args[i] = args[i] / curSpeed;
                                            }
                                        }
                                        return boundFn.apply(this, args);
                                    };
                                    return wrappedBoundFn;
                                }
                            }
                        } catch(e) {}
                        return boundFn;
                    };
                    globalThis._v20_bind_hooked = true;
                    hookedMethods.push("Function.bind");
                }
            } catch(e) { globalThis._speedLog('[LAYER 5] ⚠️ bind 拦截失败: ' + e); }
            globalThis._rsparkUpdateHooked = true;
            globalThis._speedLog('[LAYER 5] 🛡️ 灵光精简版守护阵列已启动');
        },

        installUniqueSparkAmbushHook: function() {
            if (globalThis._uniqueSparkAmbushInstalled) return;
            try {
                var nodeProto = cc.Node.prototype;
                if (nodeProto && !nodeProto._v20_layer6_update_trap) {
                    var origDescriptor = Object.getOwnPropertyDescriptor(nodeProto, 'update');
                    var origUpdate = origDescriptor ? origDescriptor.value : undefined;
                    Object.defineProperty(nodeProto, 'update', {
                        get: function() {
                            if (this.hasOwnProperty('_v20_update_wrapped')) return this._v20_update_wrapped;
                            if (this.hasOwnProperty('_v20_update_raw')) return this._v20_update_raw;
                            return origUpdate;
                        },
                        set: function(fn) {
                            if (typeof fn !== 'function') {
                                Object.defineProperty(this, '_v20_update_raw', { value: fn, writable: true, configurable: true });
                                if (this.hasOwnProperty('_v20_update_wrapped')) delete this._v20_update_wrapped;
                                return;
                            }
                            var isSparkCandidate = false;
                            try {
                                if (fn.name === '' || fn.name === 'update') {
                                    if (globalThis._rsparkSelectActive) isSparkCandidate = true;
                                }
                            } catch(e) {}

                            if (isSparkCandidate && !fn._v20_layer6_wrapped) {
                                var origFn = fn;
                                var wrappedFn = function(dt) {
                                    var fixedDt = dt;
                                    var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                    if (curSpeed > 1 && typeof fixedDt === 'number') fixedDt = dt / curSpeed;
                                    return origFn.call(this, fixedDt);
                                };
                                wrappedFn._v20_layer6_wrapped = true;
                                wrappedFn._v20_original = origFn;
                                globalThis._speedLog('[LAYER 6] 🎯 守株待兔! 捕获独特灵光 update 闭包');
                                Object.defineProperty(this, '_v20_update_wrapped', { value: wrappedFn, writable: true, configurable: true });
                                Object.defineProperty(this, '_v20_update_raw', { value: origFn, writable: true, configurable: true });
                                return;
                            }
                            Object.defineProperty(this, '_v20_update_raw', { value: fn, writable: true, configurable: true });
                            if (this.hasOwnProperty('_v20_update_wrapped')) delete this._v20_update_wrapped;
                        },
                        configurable: true,
                        enumerable: true
                    });
                    nodeProto._v20_layer6_update_trap = true;
                }
            } catch(e) { globalThis._speedLog('[LAYER 6] ⚠️ cc.Node.prototype.update setter trap 安装失败: ' + e); }
            globalThis._uniqueSparkAmbushInstalled = true;
            globalThis._speedLog('[LAYER 6] 🛡️ 独特灵光守株待兔阵列已启动');
        },

        ensureGuardsInstalled: function() {
            if (!this._sparkGuardInstalled) { try { this.install(); } catch (e) { } }
            if (!globalThis._comprehensiveSparkGuardInstalled || !globalThis._comprehensiveSparkGuardPhase4Done) {
                try { this.installComprehensive(); } catch (e) { }
            }
            if (!globalThis._rsparkUpdateHooked) { try { this.installRSparkUpdateHook(); } catch (e) { } }
            if (!globalThis._uniqueSparkAmbushInstalled) { try { this.installUniqueSparkAmbushHook(); } catch (e) { } }
        }
    };

    __app.registerService('SparkGuardService', SparkGuardService);

    // Provide legacy global names for backward compatibility
    globalThis._installSparkGuard = function() { SparkGuardService.install(); };
    globalThis._installComprehensiveSparkGuard = function() { SparkGuardService.installComprehensive(); };
    globalThis._ensureGuardsInstalled = function() { SparkGuardService.ensureGuardsInstalled(); };
    globalThis._installRSparkUpdateHook = function() { SparkGuardService.installRSparkUpdateHook(); };
    globalThis._installUniqueSparkAmbushHook = function() { SparkGuardService.installUniqueSparkAmbushHook(); };
    globalThis._sparkGuardActive = false; // Initial sync
})();
// --- [MODULE END] 06_spark_guard.js ---

// --- End of 06_spark_guard.js ---


// --- Start of 07_anim_skip.js ---
// --- [MODULE START] 07_anim_skip.js ---
(function() {
// ============================================================
// F11 触发 — 战斗动画跳过 v2
// 策略：Hook cc.DelayTime.create + 扫描实体 action_state
// 只在战斗中生效，不影响 UI / 大厅
// ============================================================
globalThis._animSkipEnabled = false;
var _animSkipTimer = null;
var _skipStats = { delayHooked: 0, delaySkipped: 0, entityForced: 0, spineAccel: 0 };
var _timerHookLog = 0; // 定时器 hook 日志计数

// (comprehensiveProbe, probeBattleGlobals, inBattle — deleted: pure probing code)
// ---- Hook 1: cc.DelayTime.create ----
var _origDelayTimeCreate = null;

function _hookDelayTime() {
    if (_origDelayTimeCreate) return; // 已经 hook 过
    try {
        if (cc && cc.DelayTime && cc.DelayTime.create) {
            _origDelayTimeCreate = cc.DelayTime.create;
            cc.DelayTime.create = function (duration) {
                _skipStats.delayHooked++;
                if (globalThis._animSkipEnabled && !_sparkGuardActive && duration > 0.02) {
                    _skipStats.delaySkipped++;
                    return _origDelayTimeCreate.call(this, 0.001);
                }
                return _origDelayTimeCreate.call(this, duration);
            };
            globalThis._speedLog('[SKIP] Hooked cc.DelayTime.create');
        } else {
            globalThis._speedLog('[SKIP] cc.DelayTime.create not found');
        }
    } catch (e) {
        globalThis._speedLog('[SKIP] DelayTime hook err: ' + e);
    }
}

// ---- Hook 2: cc.FadeIn / cc.FadeOut / cc.ScaleTo 等动画 ----
var _origFadeInCreate = null;
var _origFadeOutCreate = null;

function _hookFadeAnimations() {
    try {
        if (cc.FadeIn && cc.FadeIn.create && !_origFadeInCreate) {
            _origFadeInCreate = cc.FadeIn.create;
            cc.FadeIn.create = function (duration) {
                if (globalThis._animSkipEnabled && duration > 0.02) {
                    return _origFadeInCreate.call(this, 0.001);
                }
                return _origFadeInCreate.call(this, duration);
            };
        }
        if (cc.FadeOut && cc.FadeOut.create && !_origFadeOutCreate) {
            _origFadeOutCreate = cc.FadeOut.create;
            cc.FadeOut.create = function (duration) {
                if (globalThis._animSkipEnabled && duration > 0.02) {
                    return _origFadeOutCreate.call(this, 0.001);
                }
                return _origFadeOutCreate.call(this, duration);
            };
        }
        globalThis._speedLog('[SKIP] Hooked FadeIn/FadeOut.create');
    } catch (e) {
        globalThis._speedLog('[SKIP] Fade hook err: ' + e);
    }
}

// ---- Hook 3: 实体 Spine 加速 ----
var _entityProbed = false;

var _cachedInterceptEntity = null; // getEntityOfUID 拦截到的实体临时缓存

function _collectEntities() {
    var list = [];
    try {
        var em = globalThis['EntityManager'];
        if (!em) return list;

        // 诊断：列出 EntityManager 的所有属性（包括原型链）
        var allProps = [];
        var propCount = 0;
        for (var k in em) {
            propCount++;
            if (propCount <= 30) {
                allProps.push(k + '=' + typeof em[k]);
            }
        }
        if (!_entityProbed) {
            globalThis._speedLog('[EM] All props(' + propCount + '): ' + allProps.join(', '));
        }

        // 方案1: 直接属性名
        var searchKeys = ['team', 'monsters', 'supporter_team', '_team', '_monsters',
            'entities', '_entities', 'entityList', 'list', 'characters',
            'actors', '_actors', 'members', 'units'];
        for (var s = 0; s < searchKeys.length; s++) {
            var val = em[searchKeys[s]];
            if (val) {
                if (Array.isArray(val)) {
                    for (var i = 0; i < val.length; i++) if (val[i]) list.push(val[i]);
                } else if (typeof val === 'object') {
                    var vk = Object.keys(val);
                    for (var i = 0; i < vk.length; i++) if (val[vk[i]] && typeof val[vk[i]] === 'object') list.push(val[vk[i]]);
                }
                if (list.length > 0 && !_entityProbed) {
                    globalThis._speedLog('[EM] Found ' + list.length + ' entities via em.' + searchKeys[s]);
                    break;
                }
            }
        }

        // 方案2: 遍历所有属性，找包含 playAnimation 或 showSparkEffect 方法的对象
        if (list.length === 0) {
            for (var k in em) {
                try {
                    var v = em[k];
                    if (v && typeof v === 'object' && !Array.isArray(v)) {
                        // 是不是实体对象？
                        if (typeof v.playAnimation === 'function' || typeof v.showSparkEffect === 'function') {
                            list.push(v);
                            if (!_entityProbed) globalThis._speedLog('[EM] Found entity at em.' + k);
                        }
                        // 是不是容器（Map/数组）包含实体？
                        if (list.length === 0) {
                            for (var kk in v) {
                                try {
                                    var vv = v[kk];
                                    if (vv && typeof vv === 'object' &&
                                        (typeof vv.playAnimation === 'function' || typeof vv.showSparkEffect === 'function')) {
                                        list.push(vv);
                                        if (!_entityProbed) globalThis._speedLog('[EM] Found entity at em.' + k + '.' + kk);
                                    }
                                } catch (e2) { }
                                if (list.length >= 3) break;
                            }
                        }
                    }
                } catch (e) { }
                if (list.length >= 3) break;
            }
        }

        // 方案3: Hook getEntityOfUID 来拦截实体引用
        // v15: 增加 Error().stack 检测 selectCardRSpark 调用链
        if (list.length === 0 && typeof em.getEntityOfUID === 'function' && !em._origGetEntityOfUID) {
            em._origGetEntityOfUID = em.getEntityOfUID;
            em.getEntityOfUID = function (uid) {
                var entity = em._origGetEntityOfUID.call(this, uid);
                if (entity && !_protoHooked) {
                    globalThis._speedLog('[EM-INTERCEPT] Got entity from getEntityOfUID(uid=' + uid + '), hooking prototype...');
                    _cachedInterceptEntity = entity;
                    try { _hookEntityPlayAnimation(true); } catch (e) { }
                    _cachedInterceptEntity = null;
                }
                // v15: Stack trace R-Spark detection
                // getEntityOfUID 是唯一不被 V8 IC 绕过的 hook 点
                // selectCardRSpark 在选牌时调用 EntityManager.getEntityOfUID(char_id)
                // 检查调用栈来判断当前是否处于 R-Spark 流程
                if (globalThis._animSkipEnabled) {
                    _getEntityCallCount++;
                    try {
                        var stack = new Error().stack;
                        // 诊断: 前10次调用记录 stack 前150字符
                        if (_getEntityCallCount <= 10) {
                            globalThis._speedLog('[EM-CALL#' + _getEntityCallCount + '] uid=' + uid + ' stack=' + (stack ? stack.substring(0, 150).replace(/\n/g, ' | ') : 'N/A'));
                        }
                        if (!_sparkGuardActive && stack && (stack.indexOf('selectCardRSpark') >= 0 || stack.indexOf('selectCardSpark') >= 0)) {
                            _sparkGuardActive = true;
                            globalThis._speedLog('[SPARK] >>> R-SPARK GUARD ON via M5:stack-trace (uid=' + uid + ')');
                            globalThis._speedLog('[SPARK] stack: ' + stack.substring(0, 300));
                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                            _sparkGuardTimer = setTimeout(function () {
                                _sparkGuardActive = false;
                                globalThis._speedLog('[SPARK] <<< auto-resume after 15s timeout');
                            }, 15000);
                        }
                    } catch (e) { }
                }
                return entity;
            };
            globalThis._speedLog('[EM] Hooked getEntityOfUID as entity interceptor (v15: +stack-trace R-Spark detection)');
        }

    } catch (e) {
        globalThis._speedLog('[EM] collectEntities error: ' + e);
    }
    return list;
}



// ---- 方案 v12: PROTOTYPE-LEVEL hook ----
// v10/v11 失败原因: V8 Inline Cache (IC) 缓存了属性查找结果
//   编译后的字节码 GetNamedProperty 第一次执行时缓存了函数引用
//   之后的调用直接用缓存，不再经过 JS 属性查找
//   因此实例级别的属性覆盖被 IC 完全绕过
// v12: hook PROTOTYPE 上的方法 — IC 缓存的是 prototype slot 的引用
//   修改 prototype 上的函数 → 所有调用都被拦截
var _protoHooked = false;
var _origProtoPlayAnimation = null;
var _origProtoSetAnimation = null;
var _origProtoGetAnimLen = null;
var _origProtoShowSparkEffect = null;
var _origProtoCheckSparkEffect = null;
var _playAnimLogCount = 0;
var _MAX_PLAY_LOGS = 200;
// 灵光一闪 exemption — 由 showSparkEffect prototype hook 驱动
// _sparkGuardActive 已在 L333 声明，此处不再重复
var _sparkGuardTimer = null;
var _battleEventHooked = false;
var _sparkCallCount = 0;  // showSparkEffect 调用次数
var _MAX_SPARK_LOGS = 100;
var _checkSparkFlag = false;  // checkSparkEffect 返回 true 时设置
var _sparkStackLogCount = 0;  // v15: stack trace 日志计数
var _getEntityCallCount = 0;  // v15: getEntityOfUID 调用计数
// v17: Buff/Collapse guard — 工厂化
var _guardOrigFuncs = {};   // {methodName: origFunction}
var _guardCounters = { buff: 0, collapse: 0 };

// v17 Guard Hook 工厂 — defineProperty accessor 包装原型方法
// 触发时激活 _sparkGuardActive，setTimeout 后自动恢复
// mode='on': 标准守卫（激活+超时恢复）  mode='off': 关闭守卫（仅当已激活时生效）
function _hookGuardMethod(proto, name, ownKeys, cfg, depth, ctorName) {
    if (ownKeys.indexOf(name) < 0) return false;
    if (typeof proto[name] !== 'function' || _guardOrigFuncs[name]) return false;
    _guardOrigFuncs[name] = proto[name];
    var origFn = _guardOrigFuncs[name];
    var logPrefix = cfg.logPrefix;
    var counterKey = cfg.counterKey;
    var timeoutMs = cfg.timeoutMs;
    var mode = cfg.mode || 'on';  // 'on' | 'off'

    var makeOnWrapper = function (self, origFn) {
        return function _guardOn() {
            if (globalThis._animSkipEnabled) {
                _guardCounters[counterKey]++;
                _sparkGuardActive = true;
                globalThis._speedLog('[' + logPrefix + '] >>> ON: ' + name + ' #' + _guardCounters[counterKey] + ' (timeout: ' + timeoutMs + 'ms)');
                if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                _sparkGuardTimer = setTimeout(function () {
                    _sparkGuardActive = false;
                    globalThis._speedLog('[' + logPrefix + '] <<< auto-resume ' + timeoutMs + 'ms');
                }, timeoutMs);
            }
            return origFn.apply(self, arguments);
        };
    };
    var makeOffWrapper = function (self, origFn) {
        return function _guardOff() {
            if (globalThis._animSkipEnabled && _sparkGuardActive) {
                globalThis._speedLog('[' + logPrefix + '] ' + name + ' → schedule OFF ' + timeoutMs + 'ms');
                if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                _sparkGuardTimer = setTimeout(function () {
                    _sparkGuardActive = false;
                    globalThis._speedLog('[' + logPrefix + '] <<< OFF via ' + name + ' (timeout: ' + timeoutMs + 'ms)');
                }, timeoutMs);
            }
            return origFn.apply(self, arguments);
        };
    };
    var makeWrapper = (mode === 'off') ? makeOffWrapper : makeOnWrapper;

    try {
        Object.defineProperty(proto, name, {
            get: function () { return makeWrapper(this, origFn); },
            configurable: true,
            enumerable: true
        });
    } catch (e) {
        // defineProperty 失败时 fallback 到直接赋值
        proto[name] = function () { return makeWrapper(this, origFn).apply(this, arguments); };
    }
    globalThis._speedLog('[PROTO] Hooked ' + name + ' on L' + depth + ':' + ctorName);
    return true;
}

// v14: 多信号 R-Spark 检测函数 (M1-M4 仍作为 showSparkEffect accessor 的辅助检测)
// 返回检测方法名 (string) 或 false
function _detectRSpark(entity, args) {
    var a2_val = args.length > 0 ? args[0] : undefined;
    var isShow = !!a2_val;
    if (!isShow) return false;  // 移除特效的调用，不是 R-Spark

    // M1: entity 自身的 ready_spark (unit_card 对象可能有)
    try {
        if (entity.ready_spark || entity.ready_red_spark) return 'M1:this.ready_spark';
    } catch (e) { }

    // M2: 参数类型检查
    // selectCardRSpark 传递 ready_spark 数据(可能是卡牌ID/对象,非 boolean)
    // 普通 spark 传递 true/false
    try {
        if (typeof a2_val !== 'boolean' && a2_val !== 1 && a2_val !== 0) {
            return 'M2:non-boolean-arg(' + typeof a2_val + ':' + String(a2_val).substring(0, 30) + ')';
        }
    } catch (e) { }

    // M3: checkSparkEffect 在最近调用中返回了 true
    if (_checkSparkFlag) {
        _checkSparkFlag = false;
        return 'M3:checkSparkEffect';
    }

    // M4: BattleHelper.battle_stage 路径检查
    try {
        var bh = globalThis['BattleHelper'];
        if (bh) {
            // 检查 BattleHelper 的静态属性
            var bs = bh.battle_stage || bh.prototype.battle_stage;
            if (bs && bs.logic) {
                // selectCardRSpark 设置 this.cards = true  
                if (bs.logic.cards === true) return 'M4:logic.cards=true';
            }
        }
    } catch (e) { }

    return false;
}

// v16: Hook BattleEventManager.emit 使用 Object.defineProperty accessor
// 字节码证实: emit(type, detail, opts) → new EventBase(type, opts, detail) → this.dispatchEvent()
// Object.defineProperty accessor 在 showSparkEffect 上已证明可绕过 V8 IC (sparkCalls=89)
// 
// 保护的事件类型:
//   ON_SPARK_START / ON_SPARK_END   — 灵光一闪 (spark card selection)
//   ADD_CS / CHANGE_CS              — Buff/状态施加
//   BREAK_IN                        — 崩溃动画
//   ON_CUTIN_START / ON_CUTIN_END   — 演出动画
//   ON_START_FATAL_ATTACK / ON_END_FATAL_ATTACK — 必杀技

var _bemEmitCallCount = 0;
var _bemDispatchCallCount = 0;
var _MAX_BEM_LOGS = 200;

// 需要保护的事件 → guard 持续时间(ms), 0 = 由对应 END 事件关闭
var _guardEvents = {
    'ON_SPARK_START': 0,          // 由 ON_SPARK_END 关闭
    'ON_CUTIN_START': 0,          // 由 ON_CUTIN_END 关闭
    'ON_START_FATAL_ATTACK': 0,   // 由 ON_END_FATAL_ATTACK 关闭
    'ON_LEAD_START': 0,           // 由 ON_LEAD_END 关闭
    'ADD_CS': 3000,               // Buff 施加 — 3秒后自动恢复
    'BREAK_IN': 4000              // 崩溃 — 4秒后自动恢复
};
var _guardEndEvents = {
    'ON_SPARK_END': true,
    'ON_CUTIN_END': true,
    'ON_END_FATAL_ATTACK': true,
    'ON_LEAD_END': true
};

function _checkBemEventGuard(eventType) {
    var typeStr = '';
    try {
        // eventType 可能是 EventBase 对象 (有 .type 属性) 或直接是字符串
        if (eventType && typeof eventType === 'object' && eventType.type) {
            typeStr = String(eventType.type);
        } else {
            typeStr = String(eventType);
        }
    } catch (e) { return; }

    if (!typeStr || !globalThis._animSkipEnabled) return;

    // 检查是否是保护事件 (guard ON)
    if (_guardEvents.hasOwnProperty(typeStr)) {
        _sparkGuardActive = true;
        globalThis._speedLog('[GUARD] >>> ON: ' + typeStr);

        var duration = _guardEvents[typeStr];
        if (duration > 0) {
            // 定时自动恢复
            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
            _sparkGuardTimer = setTimeout(function () {
                _sparkGuardActive = false;
                globalThis._speedLog('[GUARD] <<< auto-resume after ' + duration + 'ms (' + typeStr + ')');
            }, duration);
        }
    }

    // 检查是否是结束事件 (guard OFF)
    if (_guardEndEvents.hasOwnProperty(typeStr)) {
        // 延迟关闭，确保最后的动画/UI 完成
        var offDelay = (typeStr === 'ON_SPARK_END') ? 1500 : 800;
        if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
        _sparkGuardTimer = setTimeout(function () {
            _sparkGuardActive = false;
            globalThis._speedLog('[GUARD] <<< OFF: ' + typeStr + ' (delayed ' + offDelay + 'ms)');
        }, offDelay);
        globalThis._speedLog('[GUARD] <<< scheduling OFF: ' + typeStr + ' in ' + offDelay + 'ms');
    }
}


function _hookEntityPlayAnimation(enable) {
    var entities = _collectEntities();
    // getEntityOfUID 拦截器缓存的实体（_collectEntities 搜不到时的后备）
    if (entities.length === 0 && _cachedInterceptEntity) {
        entities = [_cachedInterceptEntity];
    }

    if (enable) {
        var hookCount = 0;

        // === 策略 1: Prototype-level hook ===
        // 找到 playAnimation 定义在原型链的哪一层，直接修改那个 prototype
        if (!_protoHooked && entities.length > 0) {
            var ent = entities[0];

            // --- 探测 entity 原型链 ---
            try {
                var proto = Object.getPrototypeOf(ent);
                var depth = 0;
                var protoChainLog = [];
                while (proto && depth < 10) {
                    var ownKeys = [];
                    try { ownKeys = Object.getOwnPropertyNames(proto); } catch (e) { }
                    var hasPlayAnim = ownKeys.indexOf('playAnimation') >= 0;
                    var constructorName = '';
                    try { constructorName = proto.constructor ? proto.constructor.name : ''; } catch (e) { }
                    protoChainLog.push('L' + depth + ':' + constructorName +
                        '(keys=' + ownKeys.length +
                        ',playAnim=' + hasPlayAnim + ')');

                    if (hasPlayAnim && typeof proto.playAnimation === 'function' && !_origProtoPlayAnimation) {
                        _origProtoPlayAnimation = proto.playAnimation;
                        proto.playAnimation = function (animName, loop) {
                            if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                _playAnimLogCount++;
                                var label = '';
                                try { label = this.getName ? this.getName() : ''; } catch (e) { }
                                globalThis._speedLog('[PLAY-P] ' + label +
                                    ' "' + animName + '"' +
                                    ' loop=' + loop +
                                    ' skip=' + (globalThis._animSkipEnabled && !_sparkGuardActive && !loop));
                            }

                            if (globalThis._animSkipEnabled && !_sparkGuardActive && !loop) {
                                _origProtoPlayAnimation.call(this, animName, loop);
                                return 0.001;
                            }
                            return _origProtoPlayAnimation.call(this, animName, loop);
                        };
                        hookCount++;
                        globalThis._speedLog('[PROTO] Hooked playAnimation on prototype L' + depth + ':' + constructorName);
                    }

                    // === v15: Hook showSparkEffect via Object.defineProperty accessor ===
                    // v14 的直接赋值被 V8 IC 绕过，v15 改用 accessor property
                    var hasShowSpark = ownKeys.indexOf('showSparkEffect') >= 0;
                    if (hasShowSpark && typeof proto.showSparkEffect === 'function' && !_origProtoShowSparkEffect) {
                        _origProtoShowSparkEffect = proto.showSparkEffect;
                        try {
                            Object.defineProperty(proto, 'showSparkEffect', {
                                get: function () {
                                    var self = this;
                                    return function _showSparkEffect_hook() {
                                        if (globalThis._animSkipEnabled && _sparkCallCount < _MAX_SPARK_LOGS) {
                                            _sparkCallCount++;
                                            var a2v = arguments.length > 0 ? arguments[0] : 'N/A';
                                            globalThis._speedLog('[SPARK-CALL#' + _sparkCallCount + '] arg=' + String(a2v).substring(0, 50) + ' type=' + typeof a2v);
                                            // 前5次调用记录实体 spark 属性
                                            if (_sparkCallCount <= 5) {
                                                try {
                                                    var sparkKeys = ['ready_spark', 'ready_red_spark', 'spark_id', 'r_spark', 'y_spark', 'r_spark_candis', 'cards', 'char_id', 'uid'];
                                                    var found = [];
                                                    for (var sk = 0; sk < sparkKeys.length; sk++) {
                                                        var sv = self[sparkKeys[sk]];
                                                        if (sv !== undefined) found.push(sparkKeys[sk] + '=' + sv);
                                                    }
                                                    globalThis._speedLog('[SPARK-ENT] props: ' + (found.length > 0 ? found.join(', ') : '(none)'));
                                                } catch (e) { }
                                            }
                                        }
                                        var method = _detectRSpark(self, arguments);
                                        if (method && globalThis._animSkipEnabled) {
                                            _sparkGuardActive = true;
                                            globalThis._speedLog('[SPARK] >>> R-SPARK GUARD ON via ' + method);
                                            if (_sparkGuardTimer) clearTimeout(_sparkGuardTimer);
                                            _sparkGuardTimer = setTimeout(function () {
                                                _sparkGuardActive = false;
                                            }, 15000);
                                        }
                                        return _origProtoShowSparkEffect.apply(self, arguments);
                                    };
                                },
                                configurable: true,
                                enumerable: true
                            });
                        } catch (e) {
                            proto.showSparkEffect = function () {
                                var method = _detectRSpark(this, arguments);
                                if (method && globalThis._animSkipEnabled) {
                                    _sparkGuardActive = true;
                                }
                                return _origProtoShowSparkEffect.apply(this, arguments);
                            };
                        }
                        hookCount++;
                        globalThis._speedLog('[PROTO] Hooked showSparkEffect via defineProperty on L' + depth + ':' + constructorName);
                    }

                    // === v14: Hook checkSparkEffect — R-Spark 候选卡牌检查 ===
                    var hasCheckSpark = ownKeys.indexOf('checkSparkEffect') >= 0;
                    if (hasCheckSpark && typeof proto.checkSparkEffect === 'function' && !_origProtoCheckSparkEffect) {
                        _origProtoCheckSparkEffect = proto.checkSparkEffect;
                        proto.checkSparkEffect = function () {
                            var result = _origProtoCheckSparkEffect.apply(this, arguments);
                            if (result && globalThis._animSkipEnabled) {
                                _checkSparkFlag = true;
                                globalThis._speedLog('[SPARK-CHECK] checkSparkEffect returned TRUE — R-Spark candidates exist');
                            }
                            return result;
                        };
                        hookCount++;
                        globalThis._speedLog('[PROTO] Hooked checkSparkEffect on prototype L' + depth + ':' + constructorName);
                    }

                    // === v17: Guard hooks via factory ===
                    var _guardDefs = [
                        { name: 'showBuffEffect', logPrefix: 'BUFF-GUARD', counterKey: 'buff', timeoutMs: 800, mode: 'on' },
                        { name: 'showDebuffEffect', logPrefix: 'BUFF-GUARD', counterKey: 'buff', timeoutMs: 800, mode: 'on' },
                        { name: 'showCollapseCardEffect', logPrefix: 'COLLAPSE-GUARD', counterKey: 'collapse', timeoutMs: 5000, mode: 'on' },
                        { name: 'turnOnCollapseAura', logPrefix: 'COLLAPSE-GUARD', counterKey: 'collapse', timeoutMs: 5000, mode: 'on' },
                        { name: 'turnOffCollapseAura', logPrefix: 'COLLAPSE-GUARD', counterKey: 'collapse', timeoutMs: 1500, mode: 'off' }
                    ];
                    for (var gi = 0; gi < _guardDefs.length; gi++) {
                        if (_hookGuardMethod(proto, _guardDefs[gi].name, ownKeys, _guardDefs[gi], depth, constructorName)) {
                            hookCount++;
                        }
                    }

                    proto = Object.getPrototypeOf(proto);
                    depth++;
                }
                globalThis._speedLog('[PROTO] entity chain: ' + protoChainLog.join(' → '));
            } catch (e) {
                globalThis._speedLog('[PROTO] entity chain error: ' + e);
            }

            // --- 探测 aninode 原型链 (setAnimation + getAnimationLength) ---
            try {
                var an = entities[0].aninode;
                if (an) {
                    var proto = Object.getPrototypeOf(an);
                    var depth = 0;
                    var aniProtoLog = [];
                    while (proto && depth < 10) {
                        var ownKeys = [];
                        try { ownKeys = Object.getOwnPropertyNames(proto); } catch (e) { }
                        var hasSetAnim = ownKeys.indexOf('setAnimation') >= 0;
                        var hasGetLen = ownKeys.indexOf('getAnimationLength') >= 0;
                        var constructorName = '';
                        try { constructorName = proto.constructor ? proto.constructor.name : ''; } catch (e) { }
                        aniProtoLog.push('L' + depth + ':' + constructorName +
                            '(setAnim=' + hasSetAnim +
                            ',getLen=' + hasGetLen + ')');

                        // Hook setAnimation on prototype
                        if (hasSetAnim && typeof proto.setAnimation === 'function' && !_origProtoSetAnimation) {
                            _origProtoSetAnimation = proto.setAnimation;
                            proto.setAnimation = function (track, animName, loop) {
                                if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                    _playAnimLogCount++;
                                    var label = '';
                                    try { label = this.getName ? this.getName() : ''; } catch (e) { }
                                    globalThis._speedLog('[ANIM-P] ' + label +
                                        ' "' + animName + '"' +
                                        ' loop=' + loop);
                                }
                                var result = _origProtoSetAnimation.call(this, track, animName, loop);
                                // 不吞掉动画，只记录触发
                                return result;
                            };
                            hookCount++;
                            globalThis._speedLog('[PROTO] Hooked setAnimation on aninode prototype L' + depth);
                        }

                        // Hook getAnimationLength on prototype
                        if (hasGetLen && typeof proto.getAnimationLength === 'function' && !_origProtoGetAnimLen) {
                            _origProtoGetAnimLen = proto.getAnimationLength;
                            proto.getAnimationLength = function (animName) {
                                var orig = _origProtoGetAnimLen.call(this, animName);
                                if (globalThis._animSkipEnabled) {
                                    if (_playAnimLogCount < _MAX_PLAY_LOGS) {
                                        _playAnimLogCount++;
                                        globalThis._speedLog('[LEN-P] "' + animName + '" orig=' + orig + ' → 0.001');
                                    }
                                    return 0.001;
                                }
                                return orig;
                            };
                            hookCount++;
                            globalThis._speedLog('[PROTO] Hooked getAnimationLength on aninode prototype L' + depth);
                        }

                        proto = Object.getPrototypeOf(proto);
                        depth++;
                    }
                    globalThis._speedLog('[PROTO] aninode chain: ' + aniProtoLog.join(' → '));
                }
            } catch (e) {
                globalThis._speedLog('[PROTO] aninode chain error: ' + e);
            }

            _protoHooked = true;
        }

        if (_timerHookLog < 10 && hookCount > 0) {
            _timerHookLog++;
            globalThis._speedLog('[TIMER] v12 hooked ' + hookCount + ' prototype methods');
        }

        return hookCount;
    } else {
        // Restore prototypes
        var restored = 0;
        if (_origProtoPlayAnimation && entities.length > 0) {
            try {
                var proto = Object.getPrototypeOf(entities[0]);
                var depth = 0;
                while (proto && depth < 10) {
                    if (Object.getOwnPropertyNames(proto).indexOf('playAnimation') >= 0) {
                        proto.playAnimation = _origProtoPlayAnimation;
                        restored++;
                        break;
                    }
                    proto = Object.getPrototypeOf(proto);
                    depth++;
                }
            } catch (e) { }
            _origProtoPlayAnimation = null;
        }
        if (_origProtoSetAnimation && entities.length > 0) {
            try {
                var an = entities[0].aninode;
                if (an) {
                    var proto = Object.getPrototypeOf(an);
                    var depth = 0;
                    while (proto && depth < 10) {
                        if (Object.getOwnPropertyNames(proto).indexOf('setAnimation') >= 0) {
                            proto.setAnimation = _origProtoSetAnimation;
                            restored++;
                            break;
                        }
                        proto = Object.getPrototypeOf(proto);
                        depth++;
                    }
                }
            } catch (e) { }
            _origProtoSetAnimation = null;
        }
        if (_origProtoGetAnimLen && entities.length > 0) {
            try {
                var an = entities[0].aninode;
                if (an) {
                    var proto = Object.getPrototypeOf(an);
                    var depth = 0;
                    while (proto && depth < 10) {
                        if (Object.getOwnPropertyNames(proto).indexOf('getAnimationLength') >= 0) {
                            proto.getAnimationLength = _origProtoGetAnimLen;
                            restored++;
                            break;
                        }
                        proto = Object.getPrototypeOf(proto);
                        depth++;
                    }
                }
            } catch (e) { }
            _origProtoGetAnimLen = null;
        }
        // Restore showSparkEffect + checkSparkEffect
        // v15: showSparkEffect 可能是 accessor property，需要用 Object.defineProperty 恢复
        if ((_origProtoShowSparkEffect || _origProtoCheckSparkEffect) && entities.length > 0) {
            try {
                var proto = Object.getPrototypeOf(entities[0]);
                var depth = 0;
                while (proto && depth < 10) {
                    var pKeys = Object.getOwnPropertyNames(proto);
                    if (_origProtoShowSparkEffect && pKeys.indexOf('showSparkEffect') >= 0) {
                        try {
                            Object.defineProperty(proto, 'showSparkEffect', {
                                value: _origProtoShowSparkEffect,
                                writable: true,
                                configurable: true,
                                enumerable: true
                            });
                        } catch (e2) {
                            proto.showSparkEffect = _origProtoShowSparkEffect;
                        }
                        restored++;
                    }
                    if (_origProtoCheckSparkEffect && pKeys.indexOf('checkSparkEffect') >= 0) {
                        proto.checkSparkEffect = _origProtoCheckSparkEffect;
                        restored++;
                    }
                    proto = Object.getPrototypeOf(proto);
                    depth++;
                }
            } catch (e) { }
            _origProtoShowSparkEffect = null;
            _origProtoCheckSparkEffect = null;
        }
        if (_sparkGuardTimer) {
            clearTimeout(_sparkGuardTimer);
            _sparkGuardTimer = null;
        }
        _protoHooked = false;
        _playAnimLogCount = 0;
        _timerHookLog = 0;
        return restored;
    }
}

// ---- Hook 4: timeSleep / waitForNextFrame — 战斗核心等待 ----
// framework.js 把这些挂到 globalThis 上：
//   timeSleep(ms)          → Promise, resolve after ms (Date.now based)
//   waitForNextFrame()     → Promise, resolve next frame
//   waitForNextFrames(n)   → Promise, resolve after n frames
// 战斗协程用 await timeSleep(ms) 等待动画完成
var _origTimeSleep = null;
var _origWaitForNextFrame = null;
var _origWaitForNextFrames = null;
var _tsHookCount = 0;
var _tsSkipCount = 0;

function _hookTimeSleep() {
    // Hook timeSleep — 这是战斗中最关键的等待
    try {
        var ts = globalThis['timeSleep'];
        if (ts && typeof ts === 'function' && !_origTimeSleep) {
            _origTimeSleep = ts;
            globalThis['timeSleep'] = function (ms) {
                _tsHookCount++;
                if (globalThis._animSkipEnabled && !_sparkGuardActive) {
                    _tsSkipCount++;
                    return _origTimeSleep(1);
                }
                return _origTimeSleep(ms);
            };
            globalThis._speedLog('[SKIP] Hooked globalThis.timeSleep');
        } else {
            globalThis._speedLog('[SKIP] timeSleep not found on globalThis, type=' + typeof ts);
        }
    } catch (e) {
        globalThis._speedLog('[SKIP] timeSleep hook err: ' + e);
    }

    // Hook waitForNextFrame — 用 setTimeout(1ms) 代替等下一帧
    // 之前担心死循环，但 setTimeout 会 yield 到事件循环，不会阻塞
    // 原始等待 ~16ms/帧，现在 ~1ms → 轮询循环快 16 倍
    try {
        var wnf = globalThis['waitForNextFrame'];
        if (wnf && typeof wnf === 'function' && !_origWaitForNextFrame) {
            _origWaitForNextFrame = wnf;
            globalThis['waitForNextFrame'] = function () {
                if (globalThis._animSkipEnabled && !_sparkGuardActive) {
                    return new Promise(function (resolve) {
                        setTimeout(resolve, 0);
                    });
                }
                return _origWaitForNextFrame();
            };
            globalThis._speedLog('[SKIP] Hooked waitForNextFrame → setTimeout(0)');
        } else {
            globalThis._speedLog('[SKIP] waitForNextFrame: type=' + typeof wnf);
        }
    } catch (e) {
        globalThis._speedLog('[SKIP] waitForNextFrame hook err: ' + e);
    }

    // Hook waitForNextFrames 同理
    try {
        var wnfs = globalThis['waitForNextFrames'];
        if (wnfs && typeof wnfs === 'function' && !_origWaitForNextFrames) {
            _origWaitForNextFrames = wnfs;
            globalThis['waitForNextFrames'] = function (n) {
                if (globalThis._animSkipEnabled && !_sparkGuardActive) {
                    return new Promise(function (resolve) {
                        setTimeout(resolve, 0);
                    });
                }
                return _origWaitForNextFrames(n);
            };
            globalThis._speedLog('[SKIP] Hooked waitForNextFrames → setTimeout(0)');
        }
    } catch (e) { }

    // 也探测 SimpleWait（之前的目标）
    try {
        var sw = globalThis['SimpleWait'];
        if (sw && typeof sw === 'function') {
            var origSW = sw;
            globalThis['SimpleWait'] = function (ms) {
                if (globalThis._animSkipEnabled && !_sparkGuardActive && ms > 16) {
                    return origSW(1);
                }
                return origSW(ms);
            };
            globalThis._speedLog('[SKIP] Hooked globalThis.SimpleWait');
        }
    } catch (e) { }
}

// ---- 主切换函数 ----
// v8: 跳过动画 — setAnimation hook
//   1. timeSleep hook → 缩短逻辑等待
//   2. setAnimation hook → 动画开始后立刻跳到结束
//   3. DelayTime hook → 完成回调 0.001s 触发
//   → 整个出牌/攻击流程秒完成
var _entityTimer = null;
var _entitySchedTarget = null;

// setInterval 可能不可用（部分宿主的 JS 上下文无 V8 定时器，也不受 00_timers hook 影响）
// 回退：cc.Director 原生调度器 schedule（dt 按当前倍率走真实秒），
//       KeepAlive 15s 周期会用 refreshHooks 兜底补挂，调度器只是加密集扫描
function _startEntityRescanTimer(fn, intervalSec) {
    if (typeof globalThis.setInterval === 'function') {
        return { type: 'v8', id: globalThis.setInterval(fn, intervalSec * 1000) };
    }
    try {
        var sched = cc.Director.getInstance().getScheduler();
        if (sched && typeof sched.schedule === 'function') {
            var target = { fn: fn };
            sched.schedule(function (dt) { try { fn(); } catch (e) { } }, target, intervalSec, cc.REPEAT_FOREVER, 0, false);
            return { type: 'sched', id: target };
        }
    } catch (e) { }
    globalThis._speedLog('[SKIP] no interval API, rely on KeepAlive refreshHooks');
    return { type: 'none', id: null };
}

function _stopEntityRescanTimer(h) {
    if (!h) return;
    try {
        if (h.type === 'v8' && typeof globalThis.clearInterval === 'function') {
            globalThis.clearInterval(h.id);
        } else if (h.type === 'sched') {
            var sched = cc.Director.getInstance().getScheduler();
            if (sched && typeof sched.unschedule === 'function') sched.unschedule(h.id);
        }
    } catch (e) { }
}

function _toggleCardSkip() {
    if (typeof globalThis._startGlobalKeepAlive === 'function' && globalThis._speedBtn) _startGlobalKeepAlive(globalThis._speedBtn);
    globalThis._animSkipEnabled = !globalThis._animSkipEnabled;

    if (globalThis._animSkipEnabled) {
        globalThis._speedLog('=== ANIMATION SKIP v17: ON (buff/collapse EntityActor guard) ===');
        _sparkCallCount = 0;
        _sparkStackLogCount = 0;
        _getEntityCallCount = 0;
        _bemEmitCallCount = 0;
        _bemDispatchCallCount = 0;
        _guardCounters.buff = 0;
        _guardCounters.collapse = 0;

        _hookDelayTime();
        _hookFadeAnimations();
        _hookTimeSleep();

        // 动画跳过需要方案4(BattleStage原型链)和黑科技7(Map投毒)提供的 spark 守卫信息
        // 两个函数都有幂等保护，不会重复安装
        try { _installComprehensiveSparkGuard(); } catch (e) { }
        try { _installSparkGuard(); } catch (e) { }


        // Hook 战斗实体的 playAnimation + getAnimationLength (v11)
        var hookCount = _hookEntityPlayAnimation(true);
        globalThis._speedLog('[SKIP] Hooked playAnimation+getAnimLen on ' + hookCount + ' targets');


        // 定时器持续 hook 新实体（无 setInterval 环境回退到引擎调度器）
        _stopEntityRescanTimer(_entityTimer);
        _entityTimer = _startEntityRescanTimer(function () {
            if (!globalThis._animSkipEnabled) return;
            _hookEntityPlayAnimation(true);
        }, 0.5);

    } else {
        globalThis._speedLog('=== ANIMATION SKIP v17: OFF ===');
        globalThis._speedLog('[SKIP] Stats: delayHook=' + _skipStats.delayHooked +
            ' delaySkip=' + _skipStats.delaySkipped +
            ' tsHook=' + _tsHookCount +
            ' tsSkip=' + _tsSkipCount +
            ' entityCalls=' + _getEntityCallCount +
            ' sparkCalls=' + _sparkCallCount +
            ' buffGuard=' + _guardCounters.buff +
            ' collapseGuard=' + _guardCounters.collapse +
            ' bemEmit=' + _bemEmitCallCount +
            ' bemDispatch=' + _bemDispatchCallCount);

        // 停止定时器
        _stopEntityRescanTimer(_entityTimer);
        _entityTimer = null;

        // 恢复所有 playAnimation + getAnimLen hooks (v11)
        var restored = _hookEntityPlayAnimation(false);
        globalThis._speedLog('[SKIP] Restored ' + restored + ' playAnimation+getAnimLen hooks');


        _sparkGuardActive = false;
    }

    // [F11 跳过状态持久化] 开关每次变化写盘一次（_toggleCardSkip 是 F11 的唯一入口）
    if (!globalThis._speedRestoring && typeof globalThis._saveSpeedState === 'function') {
        globalThis._saveSpeedState('last_skip', globalThis._animSkipEnabled ? 1 : 0);
    }

    _updateSpeedLabel();
}



    var AnimSkipService = {
        _toggleCardSkip: _toggleCardSkip,
        _hookDelayTime: _hookDelayTime,
        _hookFadeAnimations: _hookFadeAnimations,
        _hookTimeSleep: _hookTimeSleep,
        refreshHooks: function() {
            _hookDelayTime();
            _hookFadeAnimations();
            try { _hookTimeSleep(); } catch(e) {}
            if (typeof _hookEntityPlayAnimation === 'function') _hookEntityPlayAnimation(true);
        }
    };
    __app.registerService('AnimSkipService', AnimSkipService);
    globalThis._toggleCardSkip = _toggleCardSkip;
    globalThis._hookDelayTime = _hookDelayTime;
    globalThis._hookFadeAnimations = _hookFadeAnimations;
    globalThis._hookTimeSleep = _hookTimeSleep;
})();
// --- [MODULE END] 07_anim_skip.js ---

// --- End of 07_anim_skip.js ---


// --- Start of 08_long_press.js ---
// --- [MODULE START] 08_long_press.js ---
(function() {
// --- LONG PRESS FIX ---
// Dynamically hook UIHelper long press event listeners to enforce real-world time thresholds using Date.now(), bypassing the engine's accelerated IgnoreTimeScaleScheduler.
var _uiHelperHooked = false;
var _origAddTouchPressing = null;
var _origAddLongPress = null;

function hook() {
    if (_uiHelperHooked) return;
    try {
        // ═══════════════════════════════════════════════════════════════
        // LAYER 1 (方向 A+B): Hook addTouchEventListener
        //   A: 诊断日志 — 打印节点 class/name/tag 确认是否战斗卡牌
        //   B: 修复 dt 传递 — 用 .call(this, fixedDt) 替代 arguments 修改
        // ═══════════════════════════════════════════════════════════════
        var hooked = false;
        var protos = [];
        if (typeof ccui !== 'undefined' && ccui.Widget && ccui.Widget.prototype) {
            protos.push({ name: 'ccui.Widget', proto: ccui.Widget.prototype });
        }
        if (typeof cc !== 'undefined' && cc.Node && cc.Node.prototype) {
            protos.push({ name: 'cc.Node', proto: cc.Node.prototype });
        }

        var _lpFixLogCount = 0;

        for (var pi = 0; pi < protos.length; pi++) {
            var entry = protos[pi];
            var widgetProto = entry.proto;
            if (!widgetProto.addTouchEventListener) continue;
            if (widgetProto._longPressHooked) { hooked = true; continue; }

            widgetProto._longPressHooked = true;
            hooked = true;

            (function(origFn, pName, wp) {
                wp.addTouchEventListener = function(selector, target) {
                    if (typeof this.update === 'function' && !this.update._isLongPressFixed) {
                        var origNodeUpdate = this.update;
                        var nodeRef = this;
                        // B: 健壮地修改 arguments 中的所有数字类型（兼容任何参数签名，如 dt 为第1个或第2个参数的情况）
                        var wrappedUpdate = function() {
                            var curSpeed = (typeof window !== 'undefined' && window.globalThis._SPEED_LEVELS && typeof window.globalThis._speedIdx !== 'undefined') ? window.globalThis._SPEED_LEVELS[window.globalThis._speedIdx] : 1;
                            var args = Array.prototype.slice.call(arguments);
                            var origDt = null;
                            var newDt = null;
                            if (curSpeed > 1) {
                                for (var i = 0; i < args.length; i++) {
                                    if (typeof args[i] === 'number') {
                                        origDt = args[i];
                                        args[i] = args[i] / curSpeed;
                                        newDt = args[i];
                                    }
                                }
                            }
                            if (this.getName && this.getName() === 'btn_card_touch') {
                                if (!this._l1_logged || this._l1_logged < 5) {
                                    this._l1_logged = (this._l1_logged || 0) + 1;
                                    var spLog = (typeof globalThis._speedLog === 'function') ? globalThis._speedLog : console.log;
                                    spLog('[LONG PRESS FIX] L1 executing btn_card_touch! curSpeed=' + curSpeed + ' origDt=' + origDt + ' newDt=' + newDt);
                                }
                            }
                            return origNodeUpdate.apply(this, args);
                        };
                        wrappedUpdate._isLongPressFixed = true;
                        wrappedUpdate._origFn = origNodeUpdate;
                        this.update = wrappedUpdate;

                        // A: 诊断日志 — 确认被包裹的是什么节点
                        if (_lpFixLogCount < 20) {
                            _lpFixLogCount++;
                            var fnName = origNodeUpdate.name || '(anon)';
                            var nodeInfo = '';
                            try {
                                var parts = [];
                                if (typeof this.getName === 'function') parts.push('name=' + this.getName());
                                if (typeof this.getTag === 'function') parts.push('tag=' + this.getTag());
                                if (this.constructor && this.constructor.name) parts.push('class=' + this.constructor.name);
                                nodeInfo = parts.join(' ');
                            } catch (e) { nodeInfo = '(info_err)'; }
                            globalThis._speedLog('[LONG PRESS FIX] ✅ L1 Wrapped "' + fnName + '" [' + nodeInfo + '] via ' + pName);
                        }
                    }
                    return origFn.apply(this, arguments);
                };
            })(widgetProto.addTouchEventListener, entry.name, widgetProto);

            globalThis._speedLog('[LONG PRESS FIX] L1 Hooked ' + entry.name + '.addTouchEventListener');
        }

        if (!hooked) return; // Not ready, retry next frame

        // ═══════════════════════════════════════════════════════════════
        // LAYER 2 (方向 C): 尝试通过 require("framework/scheduler") 获取 Scheduler 原型
        //   直接 hook Scheduler.prototype.update，从源头上修正 time_scale=1 的 dt
        // ═══════════════════════════════════════════════════════════════
        try {
            var sm = null;
            var loadMethod = "none";
            
            if (typeof yuna !== 'undefined' && yuna.SchedulerManager) {
                sm = yuna.SchedulerManager; loadMethod = "yuna.SchedulerManager";
            } else if (typeof window !== 'undefined' && window.yuna && window.yuna.SchedulerManager) {
                sm = window.yuna.SchedulerManager; loadMethod = "window.yuna.SchedulerManager";
            } else if (typeof window !== 'undefined' && window.SchedulerManager) {
                sm = window.SchedulerManager; loadMethod = "window.SchedulerManager";
            } else {
                var req = (typeof require === 'function') ? require : ((typeof window !== 'undefined' && typeof window.require === 'function') ? window.require : null);
                if (req) {
                    try { sm = req("framework/scheduler"); loadMethod = "require"; } catch(e) { loadMethod = "require_error"; }
                }
                if (!sm && typeof window !== 'undefined') {
                    for (var k in window) {
                        try {
                            if (window[k] && typeof window[k] === 'object' && typeof window[k].getIgnoreTimeScaleScheduler === 'function') {
                                sm = window[k]; loadMethod = "window_scan_" + k; break;
                            }
                        } catch(e) {}
                    }
                }
            }
            
            if (sm) {
                var ignoreSched = null;
                if (typeof sm.getIgnoreTimeScaleScheduler === 'function') {
                    ignoreSched = sm.getIgnoreTimeScaleScheduler();
                } else if (sm.ignore_timescale_scheduler) {
                    var keys = Object.keys(sm.ignore_timescale_scheduler);
                    if (keys.length > 0) ignoreSched = sm.ignore_timescale_scheduler[keys[0]];
                }
                
                var schedProto = null;
                if (ignoreSched) {
                    schedProto = ignoreSched.__proto__ || Object.getPrototypeOf(ignoreSched);
                } else if (sm.Scheduler && sm.Scheduler.prototype) {
                    schedProto = sm.Scheduler.prototype;
                }
                
                if (schedProto && typeof schedProto.update === 'function' && !schedProto._longPressUpdateHooked) {
                    schedProto._longPressUpdateHooked = true;
                    var origSchedUpdate = schedProto.update;
                    var _l2LogCount = 0;
                    
                    schedProto.update = function(dt) {
                        var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                        if (curSpeed > 1 && this.list && this.time_scale === 1) {
                            var fixedDt = dt / curSpeed;
                            if (_l2LogCount < 5) {
                                _l2LogCount++;
                                globalThis._speedLog('[LONG PRESS FIX] 🔧 L2 Scheduler(ts=1) update: dt=' + dt.toFixed(4) + ' → fixedDt=' + fixedDt.toFixed(4) + ' (÷' + curSpeed + ') list.len=' + (this.list.length || 0));
                            }
                            return origSchedUpdate.call(this, fixedDt);
                        }
                        return origSchedUpdate.call(this, dt);
                    };
                    globalThis._speedLog('[LONG PRESS FIX] ✅ L2 Hooked Scheduler.prototype.update via ' + loadMethod + '!');
                } else if (schedProto && schedProto._longPressUpdateHooked) {
                    globalThis._speedLog('[LONG PRESS FIX] L2 Scheduler.prototype.update already hooked');
                } else {
                    globalThis._speedLog('[LONG PRESS FIX] ⚠️ L2 Found module (' + loadMethod + ') but could not hook Scheduler.prototype.update');
                }
            } else {
                globalThis._speedLog('[LONG PRESS FIX] ⚠️ L2 Could not find SchedulerManager. loadMethod=' + loadMethod);
            }
        } catch (e) {
            globalThis._speedLog('[LONG PRESS FIX] ⚠️ L2 setup error: ' + e);
        }

        // ═══════════════════════════════════════════════════════════════
        // LAYER 3: 定期扫描（用 cc.Action 替代 setInterval）
        //   使用 cc.Director.getScheduler().schedule() 每 3 秒扫描一次
        //   找到场景中未修补的节点 update 并包裹
        // ═══════════════════════════════════════════════════════════════
        try {
            var _scanLogCount = 0;
            var _scanTarget = { _scanTick: 0 };

            // 使用引擎原生 scheduler 的 scheduleCallbackForTarget
            var nativeSched = cc.Director.getInstance().getScheduler();
            if (nativeSched && typeof nativeSched.schedule === 'function') {
                nativeSched.schedule(function(dt) {
                    try {
                        var scene = cc.Director.getInstance().getRunningScene();
                        if (!scene) return;

                        var queue = [scene];
                        var wrapped = 0;
                        var scanned = 0;
                        while (queue.length > 0) {
                            var node = queue.shift();
                            if (!node) continue;
                            scanned++;

                            if (typeof node.update === 'function' && !node.update._isLongPressFixed) {
                                if (typeof node.addTouchEventListener === 'function') {
                                    var origUpd = node.update;
                                    var fn = (function(orig) {
                                        var f = function(dt2) {
                                            var curSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                            var fixedDt2 = (curSpeed > 1) ? (dt2 / curSpeed) : dt2;
                                            return orig.call(this, fixedDt2);
                                        };
                                        f._isLongPressFixed = true;
                                        return f;
                                    })(origUpd);
                                    node.update = fn;
                                    wrapped++;
                                }
                            }

                            try {
                                if (typeof node.getChildren === 'function') {
                                    var children = node.getChildren();
                                    if (children) {
                                        var clen = (typeof children.length === 'function') ? children.length() : children.length;
                                        for (var ci = 0; ci < clen; ci++) {
                                            var child = (typeof children.get === 'function') ? children.get(ci) : children[ci];
                                            if (child) queue.push(child);
                                        }
                                    }
                                }
                            } catch (e) { }
                        }

                        if (wrapped > 0 && _scanLogCount < 10) {
                            _scanLogCount++;
                            globalThis._speedLog('[LONG PRESS FIX] 🔍 L3 Scan: wrapped ' + wrapped + '/' + scanned + ' nodes');
                        }
                    } catch (e) {
                        if (_scanLogCount < 3) {
                            _scanLogCount++;
                            globalThis._speedLog('[LONG PRESS FIX] L3 scan error: ' + e);
                        }
                    }
                }, _scanTarget, 3.0, cc.REPEAT_FOREVER || 0xFFFFFFFF, 0, false);
                globalThis._speedLog('[LONG PRESS FIX] L3 Scheduled periodic scan (3s interval via cc.Scheduler)');
            } else {
                globalThis._speedLog('[LONG PRESS FIX] ⚠️ L3 Native scheduler.schedule not available');
            }
        } catch (e) {
            globalThis._speedLog('[LONG PRESS FIX] L3 setup error: ' + e);
        }

        _uiHelperHooked = true;
        globalThis._speedLog('[LONG PRESS FIX] ✅ All layers installed (L1:proto + L2:scheduler + L3:scan)');
    } catch (e) {
        if (!_uiHelperHooked) {
            globalThis._speedLog('[LONG PRESS FIX] hook error: ' + e);
            _uiHelperHooked = true;
        }
    }
}

    var LongPressService = {
        hook: hook
    };
    __app.registerService('LongPressService', LongPressService);
    globalThis._hookLongPressUpdateProperty = function() { LongPressService.hook(); };
})();
// --- [MODULE END] 08_long_press.js ---

// --- End of 08_long_press.js ---


// --- Start of 09_speed_ui.js ---
// --- [MODULE START] 09_speed_ui.js ---
(function() {
    globalThis._speedBtn = null;
    globalThis._speedLabel = null;
    globalThis._speedBtnVisible = true;

function _applySpeed(speed) {
    if (typeof globalThis._startGlobalKeepAlive === 'function' && globalThis._speedBtn) _startGlobalKeepAlive(globalThis._speedBtn);
    var results = [];
    try {
        cc.Director.getInstance().getScheduler().setTimeScale(speed);
        results.push('scheduler_ok');
    } catch (e) { results.push('scheduler_err:' + e); }
    try {
        var dir = cc.Director.getInstance();
        if (typeof dir.getSchedulerByIndex === 'function') {
            var s = dir.getSchedulerByIndex(0);
            if (s && typeof s.setTimeScale === 'function') {
                s.setTimeScale(speed);
                results.push('schedulerByIdx_ok');
            }
        }
    } catch (e) { results.push('schedulerByIdx_err:' + e); }
    try {
        if (typeof yuna !== 'undefined' && yuna.setenv) {
            yuna.setenv('time_scale', speed);
            results.push('yuna_ok');
        }
    } catch (e) { results.push('yuna_err:' + e); }
    globalThis._speedLog('Set speed=' + speed + 'x | ' + results.join(','));
}

// ═══════════════════════════════════════════════════════════════
// [统一加速入口] 所有用户触发的加速操作都走这个包装函数
//   1. 执行实际提速 (globalThis._applySpeed)
//   2. 更新主按钮标签 (_updateSpeedLabel)
//   3. 同步滑动条 UI (_syncSliderUI)
//   4. speed > 1 时自动检测并安装黑科技 4+7
// ═══════════════════════════════════════════════════════════════
var _syncSliderUI = null; // 由 _createSpeedButton 闭包内赋值


function _setSpeedAndGuard(speed) {
    globalThis._applySpeed(speed);
    _updateSpeedLabel();
    // 同步滑动条弹出层 UI（如果存在）
    if (typeof _syncSliderUI === 'function') {
        try { _syncSliderUI(speed); } catch (e) { }
    }
    // 加速状态下自动确保黑科技已安装
    if (speed > 1) {
        _ensureGuardsInstalled();
    }
    // [状态持久化] 记忆当前倍速到 speed_config.txt（启动恢复流程内部调用时跳过，避免冗余写盘）
    if (!globalThis._speedRestoring && typeof globalThis._saveSpeedState === 'function') {
        globalThis._saveSpeedState('last_speed', speed);
    }
}

// ═══════════════════════════════════════════════════════════════
// [强制回主界面] key_home 热键（默认 F8）
//   加速导致场景/调度异常、无法正常返回时的一键逃生通道：
//   1. 强制 1x：_setSpeedAndGuard(1) + 手动钉回所有调度器与 yuna time_scale
//   2. 用未加速的原生 setTimeout 延迟 500ms，让复位先落地
//   3. 调原生全局 _restart_content() 重启内容层回标题流程
//      （title_popups.js 中 TitleBlockPopup 的缺省回调即此调用，官方通道）
// ═══════════════════════════════════════════════════════════════
var _homeBusy = false;
function _forceGoHome() {
    if (_homeBusy) {
        globalThis._speedLog('[HOME] 上一次重启仍在进行中，忽略重复触发');
        return;
    }
    _homeBusy = true;
    globalThis._speedLog('[HOME] 热键触发：强制 1x → 重启内容层回标题');

    try { globalThis._setSpeedAndGuard(1); } catch (e) { globalThis._speedLog('[HOME] setSpeed err: ' + e); }

    // [HOME] 同步关闭动画跳过，与强制 1x 一起构成"完全复位"
    //   复用 F11 官方开关：OFF 分支会一并停掉实体重扫定时器、
    //   还原全部 playAnimation/getAnimLen hooks，并写盘 last_skip=0
    try {
        if (globalThis._animSkipEnabled && typeof globalThis._toggleCardSkip === 'function') {
            globalThis._toggleCardSkip();
            globalThis._speedLog('[HOME] 动画跳过已关闭 (skip=OFF)');
        }
    } catch (e) { globalThis._speedLog('[HOME] reset skip err: ' + e); }

    // 双保险复位：不依赖 _applySpeed 的实现细节，直接钉回 1x
    try {
        cc.Director.getInstance().getScheduler().setTimeScale(1);
        var dir = cc.Director.getInstance();
        if (typeof dir.getSchedulerByIndex === 'function') {
            for (var si = 0; si < 5; si++) {
                try { var s = dir.getSchedulerByIndex(si); if (s && typeof s.setTimeScale === 'function') s.setTimeScale(1); } catch (e) { }
            }
        }
        if (typeof yuna !== 'undefined' && yuna.setenv) yuna.setenv('time_scale', 1);
    } catch (e) { globalThis._speedLog('[HOME] reset timescale err: ' + e); }

    // 用 hook 前的原生 setTimeout：保证 500ms 是真实时间，不受当前倍速影响
    var nativeSetTimeout = globalThis._origSetTimeout || setTimeout;
    nativeSetTimeout(function () {
        var restarted = false;
        try {
            if (typeof _restart_content === 'function') {
                _restart_content();
                restarted = true;
                globalThis._speedLog('[HOME] _restart_content() 已触发');
            }
        } catch (e) { globalThis._speedLog('[HOME] _restart_content err: ' + e); }
        if (!restarted) {
            try {
                if (typeof yuna !== 'undefined' && typeof yuna.restart_content === 'function') {
                    yuna.restart_content();
                    globalThis._speedLog('[HOME] 兜底 yuna.restart_content() 已触发');
                } else {
                    globalThis._speedLog('[HOME] ❌ 未找到可用的 restart_content 通道');
                }
            } catch (e) { globalThis._speedLog('[HOME] yuna.restart_content err: ' + e); }
        }
        _homeBusy = false;
    }, 500);
}

globalThis._speedCreateFailed = false;

function _createSpeedButton() {
    if (globalThis._speedCreateFailed) return null;
    if (globalThis._speedBtn) {
        try { globalThis._speedBtn.removeFromParent(true); } catch (e) { }
        globalThis._speedBtn = null; globalThis._speedLabel = null;
    }
    try {
        var scene = cc.Director.getInstance().getRunningScene();
        if (scene) {
            var oldBtn = scene.getChildByTag(9876543);
            if (oldBtn) oldBtn.removeFromParent(true);
        }
    } catch (e) { }

    var step = 'start';
    try {
        try { globalThis._loadSpeedConfig(); } catch (e) { globalThis._speedLog('[CONFIG] globalThis._loadSpeedConfig error: ' + e); }
        var winSize = cc.Director.getInstance().getWinSize();

        function _setSize(node, w, h) {
            if (!node) return;
            try {
                if (typeof cc.size === 'function') { node.setContentSize(cc.size(w, h)); return; }
                else { node.setContentSize({ width: w, height: h }); return; }
            } catch (e) { }
            try { if (typeof node.changeWidthAndHeight === 'function') node.changeWidthAndHeight(w, h); } catch (e) { }
        }
        function _setPos(node, x, y) {
            if (!node) return;
            try { node.setPosition(x, y); return; } catch (e) { }
            try { if (typeof cc.p === 'function') { node.setPosition(cc.p(x, y)); return; } else { node.setPosition({ x: x, y: y }); return; } } catch (e) { }
        }
        function _getPos(node) {
            if (!node) return { x: 0, y: 0 };
            try {
                var p = node.getPosition();
                if (Array.isArray(p)) return { x: p[0], y: p[1] };
                return { x: p.x || 0, y: p.y || 0 };
            } catch (e) { return { x: 0, y: 0 }; }
        }

        // 1. Create Main Button
        step = 'create_container';
        var container;
        if (typeof ccui !== 'undefined' && ccui.Widget && ccui.Widget.create) {
            container = ccui.Widget.create();
            try { container.setAnchorPoint(0, 0); } catch (e) { }
            container.setTouchEnabled(true);
            var bg = cc.LayerColor.create(new cc.Color(0, 0, 0, 200));
            _setSize(bg, 80, 80);
            container.addChild(bg);

            container.addTouchEventListener(function (sender, state, x, y) {
                var pos;
                if (typeof x === 'number' && typeof y === 'number') {
                    pos = { x: x, y: y };
                } else {
                    if (state === 0 && typeof sender.getTouchBeganPosition === 'function') pos = sender.getTouchBeganPosition();
                    else if (state === 1 && typeof sender.getTouchMovePosition === 'function') pos = sender.getTouchMovePosition();
                    else if (typeof sender.getTouchEndPosition === 'function') pos = sender.getTouchEndPosition();
                    else pos = { x: 0, y: 0 };
                }
                if (Array.isArray(pos)) pos = { x: pos[0], y: pos[1] };
                else if (!pos || typeof pos.x !== 'number') pos = { x: 0, y: 0 };

                if (state === 0) _handleInputBegan(pos);
                else if (state === 1) _handleInputMoved(pos);
                else _handleInputEnded(pos);
            });
            globalThis._speedLog('Using ccui.Widget for container touches');
        } else {
            container = cc.LayerColor.create(new cc.Color(0, 0, 0, 200));
            globalThis._speedLog('Using fallback cc.LayerColor container');
        }
        _setSize(container, 80, 80);
        _setPos(container, globalThis._btnPosX, globalThis._btnPosY);
        try { container.setTag(9876543); } catch (e) { }

        var label = null;
        try {
            if (cc.Label && cc.Label.createWithTTF) label = cc.Label.createWithTTF('1x', 'font/font_main.ttf', 36);
            else if (cc.LabelTTF) label = cc.LabelTTF.create('1x', 'font/font_main.ttf', 36);
            else if (cc.Label && cc.Label.createWithSystemFont) label = cc.Label.createWithSystemFont('1x', 'Arial', 36);
        } catch (e) { }
        if (!label) {
            try {
                if (cc.Label && cc.Label.create) label = cc.Label.create('1x', 'Arial', 36);
            } catch (e) { }
        }
        if (label) {
            try { if (label.setFontSize) label.setFontSize(36); } catch (e) { }
            try { if (label.setSystemFontSize) label.setSystemFontSize(36); } catch (e) { }
            _setPos(label, 40, 40);
            container.addChild(label, 1);
            globalThis._speedLabel = label;
        }

        // 2. Create Popup Panel
        step = 'create_popup';
        var popup;
        if (typeof ccui !== 'undefined' && ccui.Widget && ccui.Widget.create) {
            popup = ccui.Widget.create();
            try { popup.setAnchorPoint(0, 0); } catch (e) { }
            popup.setTouchEnabled(true);
            var popupBg = cc.LayerColor.create(new cc.Color(20, 20, 20, 240));
            _setSize(popupBg, 400, 120);
            popup.addChild(popupBg);

            popup.addTouchEventListener(function (sender, state, x, y) {
                var pos;
                if (typeof x === 'number' && typeof y === 'number') {
                    pos = { x: x, y: y };
                } else {
                    if (state === 0 && typeof sender.getTouchBeganPosition === 'function') pos = sender.getTouchBeganPosition();
                    else if (state === 1 && typeof sender.getTouchMovePosition === 'function') pos = sender.getTouchMovePosition();
                    else if (typeof sender.getTouchEndPosition === 'function') pos = sender.getTouchEndPosition();
                    else pos = { x: 0, y: 0 };
                }

                if (state === 0) _handleInputBegan(pos);
                else if (state === 1) _handleInputMoved(pos);
                else _handleInputEnded(pos);
            });
        } else {
            popup = cc.LayerColor.create(new cc.Color(20, 20, 20, 240));
        }
        _setSize(popup, 400, 120);
        _setPos(popup, 0, 90);
        popup.setVisible(false);
        container.addChild(popup, 10);

        var track = cc.LayerColor.create(new cc.Color(100, 100, 100, 255));
        _setSize(track, 300, 10);
        _setPos(track, 50, 40);
        popup.addChild(track, 1);

        var thumb = cc.LayerColor.create(new cc.Color(255, 255, 255, 255));
        _setSize(thumb, 30, 40);
        _setPos(thumb, 50, 25);
        popup.addChild(thumb, 2);

        var sliderLabel = null;
        try {
            if (cc.Label && cc.Label.createWithTTF) sliderLabel = cc.Label.createWithTTF('Speed: 1.0x', 'font/font_main.ttf', 36);
            else if (cc.LabelTTF) sliderLabel = cc.LabelTTF.create('Speed: 1.0x', 'font/font_main.ttf', 36);
            else if (cc.Label && cc.Label.createWithSystemFont) sliderLabel = cc.Label.createWithSystemFont('Speed: 1.0x', 'Arial', 36);
        } catch (e) { }
        if (!sliderLabel) {
            try {
                if (cc.Label && cc.Label.create) sliderLabel = cc.Label.create('Speed: 1.0x', 'Arial', 36);
            } catch (e) { }
        }
        if (sliderLabel) {
            try { if (sliderLabel.setFontSize) sliderLabel.setFontSize(36); } catch (e) { }
            try { if (sliderLabel.setSystemFontSize) sliderLabel.setSystemFontSize(36); } catch (e) { }
            _setPos(sliderLabel, 200, 90);
            popup.addChild(sliderLabel, 1);
        }

        var _sliderMinSpd = 1.0;
        var _sliderMaxSpd = 10.0;
        var _sliderLen = 300;
        var _sliderMinX = 50;

        function _updateSliderUI(spd) {
            if (!thumb) return;
            var pct = (spd - _sliderMinSpd) / (_sliderMaxSpd - _sliderMinSpd);
            pct = Math.max(0, Math.min(1, pct));
            var newX = _sliderMinX + pct * _sliderLen - 15;
            _setPos(thumb, newX, 25);
            if (sliderLabel) {
                try { sliderLabel.setString('Speed: ' + spd.toFixed(1) + 'x'); } catch (e) { }
            }
        }
        // 将闭包内的滑动条同步函数暴露给全局包装函数 globalThis._setSpeedAndGuard
        _syncSliderUI = _updateSliderUI;

        var initialSpeed = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
        _updateSliderUI(initialSpeed);

        // 3. Event Listeners
        step = 'listeners';
        var disp = cc.Director.getInstance().getEventDispatcher();

        var _t_dragTarget = null;
        var _t_dragStart = null;
        var _t_prevPos = null;
        var _t_isDragged = false;

        function _handleInputBegan(pos) {
            try {
                if (!container || !container.getParent()) return false;
                var nPos = _getPos(container);
                var dx = pos.x - nPos.x;
                var dy = pos.y - nPos.y;

                globalThis._speedLog('InputBegan pos=' + Math.round(pos.x) + ',' + Math.round(pos.y) + ' nPos=' + Math.round(nPos.x) + ',' + Math.round(nPos.y) + ' dx=' + Math.round(dx) + ' dy=' + Math.round(dy));

                if (popup && popup.isVisible()) {
                    var pPos = _getPos(popup);
                    var globalPopupX = nPos.x + pPos.x;

                    var globalPopupY = nPos.y + pPos.y;
                    var pdx = pos.x - globalPopupX;
                    var pdy = pos.y - globalPopupY;

                    if (pdx >= -20 && pdx <= 420 && pdy >= -20 && pdy <= 140) {
                        if (pdy >= -20 && pdy <= 90 && pdx >= 10 && pdx <= 390) {
                            _t_dragTarget = 'slider';
                            _t_isDragged = true;
                            _handleInputMoved(pos);
                            return true;
                        }
                        _t_dragTarget = 'popup_bg';
                        return true;
                    }
                }

                if (dx >= -20 && dx <= 100 && dy >= -20 && dy <= 100) {
                    _t_dragTarget = 'button';
                    _t_dragStart = pos;
                    _t_prevPos = pos;
                    _t_isDragged = false;
                    return true;
                }

                if (popup && popup.isVisible()) {
                    popup.setVisible(false);
                    return true;
                }
            } catch (e) { globalThis._speedLog('inputBegan err: ' + e); }
            return false;
        }

        function _handleInputMoved(pos) {
            try {
                if (!_t_dragTarget) return;
                if (_t_dragTarget === 'button') {
                    var dx = pos.x - _t_prevPos.x;
                    var dy = pos.y - _t_prevPos.y;
                    if (!_t_isDragged && (Math.abs(pos.x - _t_dragStart.x) > 5 || Math.abs(pos.y - _t_dragStart.y) > 5)) {
                        _t_isDragged = true;
                    }
                    if (_t_isDragged) {
                        var nodePos = _getPos(container);
                        _setPos(container, nodePos.x + dx, nodePos.y + dy);
                    }
                    _t_prevPos = pos;
                } else if (_t_dragTarget === 'slider') {
                    var nPos = _getPos(container);
                    var pPos = _getPos(popup);
                    var globalPopupX = nPos.x + pPos.x;
                    var pdx = pos.x - globalPopupX;

                    var pct = (pdx - _sliderMinX) / _sliderLen;
                    pct = Math.max(0, Math.min(1, pct));
                    var spd = _sliderMinSpd + pct * (_sliderMaxSpd - _sliderMinSpd);
                    spd = Math.round(spd * 2) / 2;
                    _updateSliderUI(spd);
                }
            } catch (e) { globalThis._speedLog('inputMoved err: ' + e); }
        }

        function _handleInputEnded(pos) {
            try {
                if (_t_dragTarget === 'button') {
                    if (!_t_isDragged) {
                        if (popup) {
                            popup.setVisible(!popup.isVisible());
                            if (popup.isVisible()) {
                                var curSpd = (typeof globalThis._SPEED_LEVELS !== 'undefined' && typeof globalThis._speedIdx !== 'undefined') ? globalThis._SPEED_LEVELS[globalThis._speedIdx] : 1;
                                _updateSliderUI(curSpd);
                            }
                        }
                    } else {
                        var nodePos = _getPos(container);
                        globalThis._btnPosX = nodePos.x;
                        globalThis._btnPosY = nodePos.y;
                    }
                } else if (_t_dragTarget === 'slider') {
                    _handleInputMoved(pos);
                    var curSpdTxt = sliderLabel ? sliderLabel.getString() : '1.0x';
                    var match = curSpdTxt.match(/(\d+\.\d+)/);
                    var spd = match ? parseFloat(match[1]) : 1.0;

                    globalThis._speedIdx = 0;
                    globalThis._SPEED_LEVELS[0] = spd;
                    globalThis._setSpeedAndGuard(spd);
                }
            } catch (e) { globalThis._speedLog('inputEnded err: ' + e); }
            _t_dragTarget = null;
            _t_isDragged = false;
        }

        if (cc.EventListenerTouchOneByOne && cc.EventListenerTouchOneByOne.create) {
            try {
                if (globalThis._speedTouchListener) {
                    try { disp.removeEventListener(globalThis._speedTouchListener); } catch (e) { }
                }
                var listener = cc.EventListenerTouchOneByOne.create();
                try { if (typeof listener.setSwallowTouches === 'function') listener.setSwallowTouches(true); } catch (e) { }
                listener.swallowTouches = true;
                listener.onTouchBegan = function (touch, event) { return _handleInputBegan(touch.getLocation()); };
                listener.onTouchMoved = function (touch, event) { _handleInputMoved(touch.getLocation()); };
                listener.onTouchEnded = function (touch, event) { _handleInputEnded(touch.getLocation()); };
                disp.addEventListenerWithFixedPriority(listener, -128);
                globalThis._speedTouchListener = listener;
            } catch (e) { globalThis._speedLog('Touch listener err: ' + e); }
        }

        if (cc.EventListenerMouse && cc.EventListenerMouse.create) {
            try {
                if (globalThis._speedMouseListener) {
                    try { disp.removeEventListener(globalThis._speedMouseListener); } catch (e) { }
                }
                var mouseListener = cc.EventListenerMouse.create();
                function getMousePos(event) {
                    var px = 0, py = 0;
                    if (typeof event.getLocation === 'function') { var loc = event.getLocation(); px = loc.x; py = loc.y; }
                    else if (typeof event.getLocationX === 'function') { px = event.getLocationX(); py = event.getLocationY(); }
                    else if (typeof event.getCursorX === 'function') { px = event.getCursorX(); py = event.getCursorY(); }
                    return { x: px, y: py };
                }
                mouseListener.onMouseDown = function (event) { if (!_t_dragTarget) _handleInputBegan(getMousePos(event)); };
                mouseListener.onMouseMove = function (event) { if (_t_dragTarget) _handleInputMoved(getMousePos(event)); };
                mouseListener.onMouseUp = function (event) { if (_t_dragTarget) _handleInputEnded(getMousePos(event)); };
                disp.addEventListenerWithFixedPriority(mouseListener, -128);
                globalThis._speedMouseListener = mouseListener;
            } catch (e) { globalThis._speedLog('Mouse listener err: ' + e); }
        }

        if (cc.EventListenerKeyboard && cc.EventListenerKeyboard.create) {
            try {
                if (globalThis._speedKbListener) {
                    try { disp.removeEventListener(globalThis._speedKbListener); } catch (e) { }
                }
                var kbListener = cc.EventListenerKeyboard.create();
                kbListener.onKeyPressed = function (keyCode, event) {
                    function _keyIn(list) { for (var i = 0; i < list.length; i++) { if (keyCode === list[i]) return true; } return false; }
                    var cfg = __app.getService('ConfigService');
                    if (!cfg) return;
                    globalThis._speedLog('[KEY] code=' + keyCode);
                    if (_keyIn(cfg._cfgKeySpeed)) {
                        if (globalThis._speedIdx <= 0) globalThis._speedIdx = cfg._cfgDefaultSpeedIdx;
                        else {
                            globalThis._speedIdx = globalThis._speedIdx + 1;
                            if (globalThis._speedIdx >= globalThis._SPEED_LEVELS.length) globalThis._speedIdx = 1;
                        }
                        globalThis._setSpeedAndGuard(globalThis._SPEED_LEVELS[globalThis._speedIdx]);
                    }
                    if (_keyIn(cfg._cfgKeyReset)) {
                        globalThis._speedIdx = 0;
                        globalThis._setSpeedAndGuard(1);
                    }
                    if (_keyIn(cfg._cfgKeySkip)) {
                        if (typeof _toggleCardSkip === 'function') globalThis._toggleCardSkip();
                    }
                    if (_keyIn(cfg._cfgKeyHideUI)) {
                        globalThis._speedBtnVisible = !globalThis._speedBtnVisible;
                        if (globalThis._speedBtn) try { globalThis._speedBtn.setVisible(globalThis._speedBtnVisible); } catch (e) { }
                    }
                    if (_keyIn(cfg._cfgKeyHome)) {
                        globalThis._speedLog('[HOME] key matched, dispatching _forceGoHome()');
                        _forceGoHome();
                    }
                };
                disp.addEventListenerWithFixedPriority(kbListener, 1);
                globalThis._speedKbListener = kbListener;
            } catch (e) { globalThis._speedLog('KB listener err: ' + e); }
        }

        globalThis._speedBtn = container;
        globalThis._speedLog('=== Button & Popup created successfully! ===');
        return container;
    } catch (e) {
        globalThis._speedLog('ERROR at step [' + step + ']: ' + e);
        globalThis._speedCreateFailed = true;
        return null;
    }
}

function _updateSpeedLabel() {
    if (!globalThis._speedLabel) { globalThis._speedLog('[LABEL] no globalThis._speedLabel ref!'); return; }
    var spd = globalThis._SPEED_LEVELS[globalThis._speedIdx];
    try {
        // 显示速度 + 动画跳过状态
        var text = spd + 'x';
        if (globalThis._animSkipEnabled) {
            text += ' [SKIP]';
        }
        globalThis._speedLabel.setString(text);
        if (globalThis._animSkipEnabled) {
            globalThis._speedLabel.setColor(new cc.Color(255, 50, 50));  // 红色=跳过激活
        } else if (spd === 1) {
            globalThis._speedLabel.setColor(new cc.Color(180, 180, 180));
        } else if (spd <= 3) {
            globalThis._speedLabel.setColor(new cc.Color(0, 255, 120));
        } else {
            globalThis._speedLabel.setColor(new cc.Color(255, 100, 60));
        }
        globalThis._speedLog('[LABEL] updated: "' + text + '"');
    } catch (e) { globalThis._speedLog('[LABEL] ERROR: ' + e); }
}


function _tryAttachSpeedButton() {
    if (globalThis._speedCreateFailed) return;
    // 已经有按钮且挂在当前场景上 → 跳过（避免每帧重建）
    if (globalThis._speedBtn) {
        try {
            var p = globalThis._speedBtn.getParent();
            if (p) {
                _startGlobalKeepAlive(globalThis._speedBtn);
                return;
            }
        } catch (e) { }
        // 按钮存在但被移出场景了（场景切换），清除引用让下面重建
        globalThis._speedBtn = null;
        globalThis._speedLabel = null;
    }
    try {
        var scene = cc.Director.getInstance().getRunningScene();
        if (!scene) return;
        var btn = _createSpeedButton();
        if (!btn) return;
        scene.addChild(btn, 99999);
        // [倍速持久化] 首次挂载即恢复上次倍速（此时引擎/调度器已完全就绪），仅执行一次
        if (!globalThis._speedPersistRestored) {
            globalThis._speedPersistRestored = true;
            // 倍速与 skip 各自独立容错：一处失败不影响另一处恢复
            try {
                var _cfg = __app.getService('ConfigService');
                var _saved = _cfg ? _cfg._cfgLastSpeed : 0;
                if (_saved > 0 && isFinite(_saved)) {
                    globalThis._speedRestoring = true;
                    var _idx = -1;
                    for (var _i = 1; _i < globalThis._SPEED_LEVELS.length; _i++) {
                        if (globalThis._SPEED_LEVELS[_i] == _saved) { _idx = _i; break; }
                    }
                    if (_idx > 0) globalThis._speedIdx = _idx;
                    else { globalThis._speedIdx = 0; globalThis._SPEED_LEVELS[0] = _saved; }
                    globalThis._setSpeedAndGuard(_saved);
                    globalThis._speedRestoring = false;
                    globalThis._speedLog('[PERSIST] Restored last_speed=' + _saved + 'x (idx=' + globalThis._speedIdx + ')');
                } else {
                    globalThis._speedLog('[PERSIST] No saved speed, start fresh (1x)');
                }
            } catch (e) {
                globalThis._speedRestoring = false;
                globalThis._speedLog('[PERSIST] Restore speed error: ' + e);
            }
            // [F11 跳过状态恢复] 上次为开启则恢复开启（走官方开关函数，hook/守卫/标签一并就位）
            try {
                var _cfg2 = __app.getService('ConfigService');
                if (_cfg2 && _cfg2._cfgLastSkip) {
                    globalThis._speedRestoring = true;
                    if (typeof globalThis._toggleCardSkip === 'function') globalThis._toggleCardSkip();
                    globalThis._speedRestoring = false;
                    globalThis._speedLog('[PERSIST] Restored last_skip=ON');
                }
            } catch (e) {
                globalThis._speedRestoring = false;
                globalThis._speedLog('[PERSIST] Restore skip error: ' + e);
            }
        }
        _updateSpeedLabel();
        globalThis._speedLog('Attached to scene');
        _startGlobalKeepAlive(btn);
    } catch (e) {
        globalThis._speedLog('ERROR attaching: ' + e);
    }
}


    var SpeedUIService = {
        _applySpeed: _applySpeed,
        _setSpeedAndGuard: _setSpeedAndGuard,
        _createSpeedButton: _createSpeedButton,
        _updateSpeedLabel: _updateSpeedLabel,
        _tryAttachSpeedButton: _tryAttachSpeedButton,
        _forceGoHome: _forceGoHome,
    };
    __app.registerService('SpeedUIService', SpeedUIService);
    globalThis._applySpeed = _applySpeed;
    globalThis._setSpeedAndGuard = _setSpeedAndGuard;
    globalThis._createSpeedButton = _createSpeedButton;
    globalThis._updateSpeedLabel = _updateSpeedLabel;
    globalThis._tryAttachSpeedButton = _tryAttachSpeedButton;
    globalThis._forceGoHome = _forceGoHome;
})();
// --- [MODULE END] 09_speed_ui.js ---

// --- End of 09_speed_ui.js ---


// --- Start of 10_probe_hooks.js ---
// --- [MODULE START] 10_probe_hooks.js ---
(function() {
var _customEvents = [];  // 收集自定义事件名

// === 启动时安装的 Hook (事件) ===
function _installProbeHooks() {
    // --- Hook A: dispatchCustomEvent 拦截所有自定义事件 ---
    try {
        var disp = cc.Director.getInstance().getEventDispatcher();
        if (disp && disp.dispatchCustomEvent) {
            var _origDispatch = disp.dispatchCustomEvent;
            disp.dispatchCustomEvent = function (eventName, optData) {
                if (_customEvents.length < 2000) {
                    _customEvents.push(eventName);
                }
                // 实时记录每个事件
                if (globalThis._animSkipEnabled) {
                    globalThis._speedLog('[EVT] ' + eventName);
                    // 灵光一闪(R-Spark) 检测
                    if (eventName && (String(eventName).indexOf('SPARK') >= 0 || String(eventName).indexOf('spark') >= 0)) {
                        _sparkGuardActive = true;
                        globalThis._speedLog('[SPARK] >>> DETECTED: ' + eventName + ' — ALL acceleration paused');
                        setTimeout(function () {
                            _sparkGuardActive = false;
                            globalThis._speedLog('[SPARK] <<< guard off (auto 3s timeout)');
                        }, 3000);
                    }
                }
                return _origDispatch.apply(this, arguments);
            };
            globalThis._speedLog('[Probe] Hook: dispatchCustomEvent OK');
        }
    } catch (e) {
        globalThis._speedLog('[Probe] Hook dispatchCustomEvent err: ' + e);
    }
}
    var ProbeHooksService = {
        _installProbeHooks: _installProbeHooks,
    };
    __app.registerService('ProbeHooksService', ProbeHooksService);
    globalThis._installProbeHooks = _installProbeHooks;
})();
// --- [MODULE END] 10_probe_hooks.js ---

// --- End of 10_probe_hooks.js ---


// --- Start of 90_main.js ---
// --- [MODULE START] 90_main.js ---
(function() {
globalThis._speedLog('Initialized. F9=加速(2x>3x>5x) F10=重置(1x) F11=综合探测 F8=强制回主界面');
globalThis._speedLog('[PERSIST] 状态记忆默认启用：倍速/动画跳过重启自动恢复（speed_config.txt: last_speed/last_skip）');

// _director_after_draw는 매우 자주 호출되므로 특별한 성능 측정 적용
let _director_after_draw_slow_count = 0;
const _original_director_after_draw = function () {
    // [免费声明] 首次进入时弹一次提示
    if (!global.pre._freeNoticeShown) {
        try {
            TitleScenePre.showNoticePopup('本软件完全免费！\n如果你是买来的，那么你被骗了！\n\n软件群聊：777529227', function () {
                // 拦截默认的重启行为，手动关闭弹窗
                try {
                    var layer = TitleScenePre.getTargetLayer();
                    if (layer && layer.getChildren) {
                        var children = layer.getChildren();
                        for (var i = 0; i < children.length; i++) {
                            var child = children[i];
                            if (child && child.findChildByName && child.findChildByName('main_text')) {
                                child.removeFromParent();
                                break;
                            }
                        }
                    }
                } catch (e) { }
            });
            global.pre._freeNoticeShown = true;
        } catch (e) { }
    }
    const patch_error = _getenv('patch.error')
    const patch_request = _getenv('patch.request')
    if (patch_request) {
        console.log('patch_request : ', patch_request)
        _setenv('patch.request', '')
    }
    if (global.pre.pause_director_after_draw) {

    } else if (patch_error) {
        let errorMessage = PreTexts.getText('patch_error') + '\n' + patch_error;
        if (patch_error.indexOf('E20114') !== -1) {
            errorMessage = PreTexts.getText('disk_space_error');
        }
        TitleScenePre.showNoticePopup(errorMessage)
        global.pre.pause_director_after_draw = true
    } else {
        const patch_status = _getenv('patch.status')
        if (!global.pre.is_load_application_resources && 'complete' == patch_status) {
            if (first_notice_after_patch) {
                process_next_notice_after_patch()
                first_notice_after_patch = false
            }
        }
        else if ('ask_download' == patch_status) {
            if (!is_waiting_for_user_action) {
                _ad_custom_event('singular', 'cdn_update_popup_shown', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
                is_waiting_for_user_action = true
                const download_total = _getenv("patch.download_total")
                const download_complete = _getenv("patch.download_complete")
                const download_kb = (download_total - download_complete) / 1024
                console.log('download_total : ', download_total, ' download_complete : ', download_complete, ' download_kb : ', download_kb)
                TitleScenePre.showConfirmDownloadPopup(download_kb, function (result) {
                    console.log('ask_download result : ', result)
                    if (result == true) {
                        console.log('ask_download result : true, start downloading')
                        _ad_custom_event('singular', 'cdn_update_popup_check_yes', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
                        _setenv('patch.status', 'downloading')
                        TitleScenePre.setPreButtonCallback(undefined)
                    } else {
                        console.log('ask_download result : false, cancel downloading')
                        _ad_custom_event('singular', 'cdn_update_popup_check_no', _getenv("stove.user_id", ''), _getenv("stove.world_id", ''), '')
                        _setenv('patch.status', 'cancel')
                        TitleScenePre.setPreButtonCallback(function () {
                            console.log('starting patch again')
                            TitleScenePre.setPreButtonCallback(undefined)
                            TitleScenePre.startPatch()
                        })
                    }
                    is_waiting_for_user_action = false
                }, global.pre.is_pre_patch)
            }
        }
        else {
            TitleScenePre.update()
        }
    }
};

// _director_after_draw는 자주 호출되므로 100ms 이상일 때만 로깅하고, 10번 연속 느릴 때 특별 알림
var _lastKeepAliveTime = 0;
function _director_after_draw() {
    const startTime = Date.now();
    const result = _original_director_after_draw.apply(this, arguments);
    const executionTime = Date.now() - startTime;

    if (executionTime > 100) {
        _director_after_draw_slow_count++;
        if (_director_after_draw_slow_count >= 10) {
            console.log(`_director_after_draw() has been slow (>100ms) ${_director_after_draw_slow_count} times in a row. Latest: ${executionTime}ms`);
            _director_after_draw_slow_count = 0; // 리셋
        }
    } else {
        _director_after_draw_slow_count = 0; // 빠르면 카운터 리셋
    }

    // [加速器] 每帧检查并挂载加速按钮
    if (typeof globalThis._tryAttachSpeedButton === 'function') {
        globalThis._tryAttachSpeedButton();
    }
    // [LONG PRESS FIX] 检查并挂载长按补丁
    if (typeof globalThis._hookLongPressUpdateProperty === 'function') {
        globalThis._hookLongPressUpdateProperty();
    }
    // [Chaos透视] 挂载
    if (typeof globalThis._tryAttachChaosHooks === 'function') {
        globalThis._tryAttachChaosHooks();
    }

    return result;
}
globalThis._director_after_draw = _director_after_draw;
})();
// --- [MODULE END] 90_main.js ---

// --- End of 90_main.js ---


// --- Start of 99_tail.js ---
function _original_display_guide_good_game_use() {
    console.log(' display_guide_good_game_use ')

    let winSize = cc.Director.getInstance().getWinSize()
    let spr_guide = cc.CSLoader.createNode('ui/guide_good_game.csb')

    if (_get_cocos_refid(spr_guide)) {
        spr_guide.setOpacity(0)
        ResolutionHandler.getInstance().alignCenter(spr_guide);
        global.pre.pre_layer.addChild(spr_guide)

        console.log('_display_guide_good_game_use', winSize.width)

        let act_logo = cc.Sequence.create(
            cc.DelayTime.create(0.3),
            cc.FadeIn.create(0.5),
            cc.DelayTime.create(3.),
            cc.CallFunc.create(function () {
                _display_logo()
            }),
            cc.CallFunc.create(function () { global.pre.pre_layer.setColor(new cc.Color(255, 255, 255)) }),
            cc.FadeOut.create(0.5),
            cc.RemoveSelf.create()
        )
        spr_guide.runAction(act_logo)
    }
    else {
        console.error('not found ui/guide_good_game.csb')
        _display_logo()
    }
}

const _display_guide_good_game_use = measurePerformance(_original_display_guide_good_game_use, '_display_guide_good_game_use');

function _original_display_engine() {
    console.log('display engine ')

    let winSize = cc.Director.getInstance().getWinSize()
    let spr_engine = cc.CSLoader.createNode('ui/engine.csb')

    spr_engine.setOpacity(0)
    ResolutionHandler.getInstance().alignCenter(spr_engine);
    global.pre.pre_layer.addChild(spr_engine)

    let eff = bootres.get_effect('logo_yuna')
    if (eff) {
        spr_engine.getChildByName('n_engine').addChild(eff)

        let act_engine = cc.Sequence.create(
            cc.DelayTime.create(0.3),
            cc.CallFunc.create(function () { eff.setAnimation(0, 'animation', false) }),
            cc.FadeIn.create(0.2),
            cc.DelayTime.create(1.7),
            cc.CallFunc.create(function () { _start_title_scene() }),
            cc.FadeOut.create(0.3),
            cc.RemoveSelf.create()
        )
        spr_engine.runAction(act_engine)
    }
}

const _display_engine = measurePerformance(_original_display_engine, '_display_engine');

function _original_play_title_voice() {
    ccexp.SoundEngine.getInstance().unloadAll();
    console.debug("[SOUND] load master.string.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/master.strings.bank"));
    console.debug("[SOUND] load master.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/master.bank"));

    const fmod_result = ccexp.SoundEngine.getInstance().loadBankFile("sound/voc.event.bank");
    console.log(`LOG ~ _play_title_voice ~ fmod_result:`, fmod_result)

    let region = cc.UserDefault.getInstance()?.getStringForKey("voice_region_key", "ja");
    if (region == undefined || region == "ja") {
        region = "jp";
    }
    console.log(`LOG ~ _play_title_voice ~ region:`, region)
    const title_voice_list_result = cc.FileUtils.getInstance().isFileExist(`voice_text/title_voice_list.txt`)
    console.log(`LOG ~ _play_title_voice ~ title_voice_list_result:`, title_voice_list_result)
    const char_bank_result = ccexp.SoundEngine.getInstance().loadBankFile(`sound/1041_voc_${region}.bank`);
    console.log(`LOG ~ _play_title_voice ~ char_bank_result:`, char_bank_result)

    let voice_event_id = "event:/character/1041/voice/title_" + region; // event:/character/1041/voice/title_jp, title_ko, title_zhs
    if (fmod_result && title_voice_list_result && char_bank_result) {
        const db_result = cc.FileUtils.getInstance().getStringFromFile("voice_text/title_voice_list.txt");
        console.log(`LOG ~ _play_title_voice ~ db_result:`, db_result);

        const char_list = db_result.split(",");
        console.log(`🚀 ~ _play_title_voice ~ char_list:`, JSON.stringify(char_list))
        const char_id_dict = char_list.reduce(function (acc, id) {
            acc[id] = true;
            return acc;
        }, {});

        let random_char_id = null;
        let try_count = 0;
        while (true) {
            // 랜덤하게 하나 선택해서 플레이, 실패하면 빼고 다른 랜덤 캐릭터
            random_char_id = Object.keys(char_id_dict)[Math.floor(Math.random() * Object.keys(char_id_dict).length)];
            if (random_char_id != undefined) {
                const voice_bank_file = `sound/${random_char_id}_voc_${region}.bank`;
                if (!ccexp.SoundEngine.getInstance().isBankLoaded(voice_bank_file)) {
                    const fmod_result = ccexp.SoundEngine.getInstance().loadBankFile(voice_bank_file);
                    console.log(`LOG ~ _play_title_voice ~ voice_bank_file : ${voice_bank_file}, load result: ${fmod_result}`)
                } else {
                    random_char_id
                }

                const voice_event_result = ccexp.SoundEngine.getInstance().existsEvent(`event:/character/${random_char_id}/voice/title`);
                console.log(`LOG ~ _play_title_voice ~ existsEvent result:`, voice_event_result);

                if (voice_event_result) {
                    voice_event_id = `event:/character/${random_char_id}/voice/title`;
                    break;
                }
            }

            delete char_id_dict[random_char_id];
            try_count++;
            if (try_count > 100) {
                console.error('try_count > 100')
                break;
            }
        }
    } else {
        ccexp.SoundEngine.getInstance().unloadAll();
        console.log(`LOG ~ _play_title_voice ~ bundle.strings.bank exists ` + cc.FileUtils.getInstance().isFileExist(`sound/bundle.strings.bank`))
        console.log(`LOG ~ _play_title_voice ~ bundle.bank exists ` + cc.FileUtils.getInstance().isFileExist(`sound/bundle.bank`))
        console.debug("[SOUND] load bundle.string.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/bundle.strings.bank"));
        console.debug("[SOUND] load bundle.bank ", ccexp.SoundEngine.getInstance().loadBankFile("sound/bundle.bank"));
    }

    if (ccexp.SoundEngine.getInstance().existsEvent(voice_event_id)) {
        console.log(`🚀 ~ _play_title_voice ~ voice_event_id:`, voice_event_id)
        const event_sound_object = ccexp.SoundEngine.getInstance().createEvent(voice_event_id);
        event_sound_object.start()
    } else {
        console.error('event not found : ', voice_event_id)
    }
}

const _play_title_voice = measurePerformance(_original_play_title_voice, '_play_title_voice');

const _original_display_rating = function () {
    let winSize = cc.Director.getInstance().getWinSize()
    let rating_node = cc.CSLoader.createNode('ui/title_rating.csb')
    rating_node.setOpacity(0)
    ResolutionHandler.getInstance().alignCenter(rating_node);

    global.pre.pre_layer.addChild(rating_node)

    console.log('_display_rating', winSize.width)

    const n_right = rating_node.getChildByName('right')
    const n_age_kr = n_right.getChildByName('n_age_kr')
    const btn_age_zhs = n_right.getChildByName('btn_age_zhs')
    const btn_age_tw = n_right.getChildByName('btn_age_tw')

    const n_right_original_pos = n_right.getPosition();
    n_right.setPosition((winSize.width - 1280) / 2, n_right_original_pos.y);

    n_age_kr.setVisible(false);
    btn_age_zhs.setVisible(false);
    btn_age_tw.setVisible(false);
    console.log('Util.getOsLanguage() : ', Util.getOsLanguage())
    switch (Util.getOsLanguage()) {
        case 'ko':
            n_age_kr.setVisible(true);
            break;
        // case 'zhs':
        // 	btn_age_zhs.setVisible(true);
        // 	break;
        // case 'zht':
        // 	btn_age_tw.setVisible(true);
        // 	break;
        default:
            {
                console.log("skip rating page, os lang : ", Util.getOsLanguage())
                rating_node.removeFromParent();
                _display_logo()
                return
            }
            break;
    }

    let act_logo = cc.Sequence.create(
        cc.DelayTime.create(0.3),
        cc.FadeIn.create(0.5),
        cc.DelayTime.create(2.5),
        cc.CallFunc.create(function () {
            _display_logo()
        }),
        cc.CallFunc.create(function () { global.pre.pre_layer.setColor(new cc.Color(255, 255, 255)) }),
        cc.FadeOut.create(0.5),
        cc.RemoveSelf.create()
    )
    rating_node.runAction(act_logo)
};
const _display_rating = measurePerformance(_original_display_rating, '_display_rating');

const _original_display_logo = function () {
    _play_title_voice();

    let winSize = cc.Director.getInstance().getWinSize()
    let spr_logo = cc.CSLoader.createNode('ui/logo.csb', function (e) { console.log(e.getName()) })
    spr_logo.setOpacity(0)
    ResolutionHandler.getInstance().alignCenter(spr_logo);
    global.pre.pre_layer.addChild(spr_logo)

    console.log('_display_logo', winSize.width)

    const n_right = spr_logo.getChildByName('right')
    n_right.setVisible(false);

    let n_logos = spr_logo.getChildByName('n_logos')
    n_logos.setScale(0.735)

    n_logos.runAction(cc.Sequence.create(cc.DelayTime.create(0.6), cc.EaseOut.create(cc.ScaleTo.create(1, 0.75), 2)))

    let act_logo_in = cc.Sequence.create(
        cc.DelayTime.create(0.3),
        cc.FadeIn.create(0.5),
        cc.DelayTime.create(1.4),
        cc.CallFunc.create(function () {
            _ad_custom_event('singular', 'czn_splash_screen_end', '0', '', '')
            spr_logo.stopAllActions()
            let act_logo_out = cc.Sequence.create(
                cc.CallFunc.create(function () { global.pre.pre_layer.setColor(new cc.Color(0, 0, 0)) }),
                cc.FadeOut.create(0.5),
                cc.CallFunc.create(function () {
                    TitleScenePre.start();
                }),
                cc.RemoveSelf.create()
            )
            spr_logo.runAction(act_logo_out)
        }),
    )
    spr_logo.runAction(act_logo_in)

    _ad_custom_event('singular', 'czn_splash_screen_start', '0', '', '')

    //번들팩 읽을때 느려서 미리 로딩 추가
    async function _preloadTitleUI() {
        try {
            console.log('[PRELOAD] Starting title UI preload...');
            const startTime = Date.now();
            const preloadedScene = cc.CSLoader.createNode('ui/scene_title_pre.csb');
            const loadTime = Date.now() - startTime;

            console.log(`[PRELOAD] _preloadTitleUI completed in ${loadTime}ms`);
        } catch (error) {
            console.error('[PRELOAD] Failed to _preloadTitleUI:', error);
        }
    };
    _preloadTitleUI().catch(error => {
        console.error('[PRELOAD] Unhandled error in title UI preload:', error);
    });
};
const _display_logo = measurePerformance(_original_display_logo, '_display_logo');

function _get_version_json() {
    try {
        /*
        const testmode_maintenance = _getenv( "maintenance.mode" , "testpatch" ) 		
        if( testmode_maintenance == "testmode" ) {
            const elpsed_time = 5
            const now = Math.floor(Date.now() / 1000)
            const test_version_json = {"_appid":"ssrdev","_entry_timestamp":now,"maintenance":[{"id":1,"world":"asia","start_time":(now-elpsed_time),"end_time":(now+elpsed_time),"title":"테스트 점검","msg":"점검 테스트 중입니다","url_notice":"","url_patch_note":"","url_sns":"","status":-1}],"world":{"asia":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"58","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.sign":"http://localhost:8000","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"ws://ssrdev.supercre.com:13100/api/","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"}},"global":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"57","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"http://czn-qa-down.game.playstove.com/patch/1.0.147/webpubs/res/cinema/ko/title2.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"","verinfo.status":"running"}}}}			
            _setenv('verinfo.data', JSON.stringify( test_version_json ) )
            _setenv( "maintenance.mode" , "" )
        }
        if( testmode_maintenance == "testpatch" ) {			
            const now = Math.floor(Date.now() / 1000)
            const test_version_json = {"_appid":"ssrdev","_entry_timestamp":now,"maintenance":[],"world":{"asia":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"58","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.sign":"http://localhost:8000","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"ws://ssrdev.supercre.com:13100/api/","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"https://czn-qa-down.game.playstove.com/patch/common/title_pre.mp4?inet_cache=ignore_update","verinfo.status":"running"}},"global":{"live":{"app.api":"ws://ssrdev.supercre.com:13100/api/","build.version":"57","cdn.context":"$(remote.res.version)/$(remote.res.version)-$(local.res.version).tar.lz4","cdn.url":"https://devpatch11.supercreative.kr:3043/ssrdev_patch/","cdn.version.policies":"res,media,text","cdn.version_media.current":1,"cdn.version_res.current":1,"cdn.version_text.current":1,"game.timezone":"9","title_movie_cdn":"http://czn-live-down.game.playstove.com/patch/common/ssr_title_24fps.mp4?inet_cache=ignore_update","title_movie_cdn_first":"http://czn-qa-down.game.playstove.com/patch/1.0.147/webpubs/res/cinema/ko/title2.mp4?inet_cache=ignore_update","verinfo.status":"running"},"review":{"app.api":"","verinfo.status":"running"}}}}			
            _setenv('verinfo.data', JSON.stringify( test_version_json ) )
            _setenv( "maintenance.mode" , "" )
        }
        */
        return JSON.parse(_getenv('verinfo.data', "{}"))
    } catch (error) {
        console.error('verinfo.data is empty : ', error)
    }
    return {}
}
globalThis._get_version_json = _get_version_json;

function _load_remote_environment_and_prefetch() {
    console.log('🚀 [EARLY FETCH] Starting native remote environment load immediately...')
    global.pre.early_fetch_promise = new Promise(function (resolve) {
        _async_load_remote_environment(function (result) {

            if (result) {
                if (`${_getenv('xcent.dolphin', 0)}` != "1") {
                    try {
                        const version_json = _get_version_json()

                        const target_version_json = EntryUtil.getTargetVersionInfo(version_json)
                        const stringified_target_version_json = JSON.stringify(target_version_json)
                        //console.log('target_version_json : ', stringified_target_version_json)
                        _load_json_environment(stringified_target_version_json)
                        //prefetch 때 멈춤
                        _setenv("patch.should", "prefetch");
                        _start_patch();
                    } catch (error) {
                        //에러나면 포기	
                        console.error("_load_remote_environment_and_prefetch error : ", error)
                    }
                }
            }
            resolve(result)
        })
    })
}

const _original_application_start_contents = function (event) {
    // _js_start_profile();


    _perf_gem_post_step_event('login', 0, 0, 0, 'success', '', false, false)
    console.log('_application_start_contents ' + typeof (event), event.getEventListener())
    cc.Director.getInstance().getEventDispatcher().removeEventListener(event.getEventListener())

    global.pre = {}
    Util._event_listeners = {}
    _setenv("patch.status", "");

    // ⭐ [EARLY FETCH] 가장 먼저 네이티브 통신 시작 (Risk 최소화 버전)
    _load_remote_environment_and_prefetch();


    console.log('application_start_contents initialized')

    // if app.lang = zhs, then set user lang as zhs too

    if (_getenv('app.lang') == 'zhs') {
        console.log('app.lang is zhs, set user lang as zhs')
        _set_user_language('zhs')
    }

    const app_production = _getenv('app.production', false)
    console.log('app.production : ', app_production)

    // 만약 app.pubid 가 xcent 가 아닌데 user lang 이 zhs 라면, 언어 초기화
    const app_pubid = _getenv('app.pubid')
    console.log('app.pubid : ', app_pubid)
    if (app_pubid != 'xcent') {
        const user_lang = Util.getUserLanguage()
        console.log('user lang : ', user_lang)
        if (user_lang == 'zhs') {
            console.log('app.pubid is not xcent, and user lang is zhs')
            if (app_production) {
                console.log('app.production is true, set user lang to default')
                _set_user_language('')
            } else {
                console.log('app.production is false, set user lang to ko')
                _set_user_language('ko')
            }
        }
    }

    Util.setPreFileFilter()

    let cocosScene = cc.Scene.create()
    //_async_load_version_info()
    //print( 'create background layer ' )
    global.pre.pre_layer = cc.LayerColor.create(new cc.Color(255, 255, 255, 255))
    cocosScene.bg_layer = global.pre.pre_layer
    cocosScene.addChild(global.pre.pre_layer)

    let play_logo = _getenv('logo.play')
    console.log('logo.play : ' + play_logo)
    if (play_logo != false) {
        if (Util.getUserLanguage() == 'zhs') {
            _display_guide_good_game_use()
        } else {
            _display_rating()
        }
    } else {
        TitleScenePre.start();
    }

    cc.Director.getInstance().runWithScene(cocosScene)

    let patch_version_override = _getenv('patch.version.override')
    if (patch_version_override != undefined) {
        console.log('patch version override:', patch_version_override)
        _setenv('patch.version', patch_version_override)
    }
    console.log('patch version : ' + _getenv('patch.version'))
};
const _application_start_contents = measurePerformance(_original_application_start_contents, '_application_start_contents');

// pre 에서 exi handler listen 하는 경우 사용 (추후 script 단에서 덮어쓰도록, 현재 gcs용)
global._external_interface_handler_call = function (type, jstr) {
    console.log('pre external interface handler call : ', type, jstr)
    if (type == 'stove/gcs') {
        global.pre.stove_gcs = jstr;
    }
};


cc.Director.getInstance().getEventDispatcher().addCustomEventListener('application_start_contents', _application_start_contents)
// --- End of 99_tail.js ---

