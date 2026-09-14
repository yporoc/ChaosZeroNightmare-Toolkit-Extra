'use strict';

Object.defineProperty(exports, "__esModule", { value: true });

const { PreTexts } = require( './pre_data.js' )

class Util {
    
    static _patchpack_version_cache = {};
    static _event_listeners = {};

    static queryHttpGet(url, header, callback) {
        let httpRequest = new cc.XMLHttpRequest();
        httpRequest.setRequestHeader("Content-Type", "application/json");
        if (header) {
            for (let key in header) {
                httpRequest.setRequestHeader(key, header[key]);
            }
        }
        httpRequest.registerScriptHandler(function () {
            if ([200, 201].includes(httpRequest.status)) {
                callback(true, httpRequest.response);
            } else {
                callback(false, httpRequest.status)
            }
            httpRequest.release()
        });
        httpRequest.responseType = cce.XMLHTTPREQUEST_RESPONSE_JSON;
        httpRequest.open("GET", url);
        httpRequest.send();
    }
    
    static getTimeString( utc_time ) {
        const utcDate = new Date(utc_time*1000);
        const year = utcDate.getUTCFullYear();
        const month = utcDate.getUTCMonth() + 1; // 월은 0부터 시작하므로 1을 더합니다.
        const date = utcDate.getUTCDate();
        const hours = utcDate.getUTCHours();
        const minutes = utcDate.getUTCMinutes();
        let amOrPm = hours < 12 ? 'AM' : 'PM';
        if (_getenv( 'app.lang', '' ) == 'zhs') {
            amOrPm = hours < 12 ? '上午' : '下午';
        }
    
        return `${year}-${month}-${date}, ${hours}:${minutes} ${amOrPm}`
    }
    
    static getLocalTimeString(utc_time, with_utc_offset = false) {
        const utcDate = new Date(utc_time * 1000);
        const year = utcDate.getFullYear();
        let month = utcDate.getMonth() + 1;
        if (month < 10) month = '0' + month;
        let date = utcDate.getDate();
        if (date < 10) date = '0' + date;
        let hours = utcDate.getHours();
        if (hours < 10) hours = '0' + hours;
        let minutes = utcDate.getMinutes();
        if (minutes < 10) minutes = '0' + minutes;
    
        let local_time_string = `${year}-${month}-${date}, ${hours}:${minutes}`;
        if (_getenv( 'app.lang', '' ) != 'zhs') {
            if (with_utc_offset) {
                let utc_offset = utcDate.getTimezoneOffset() / -60;
                local_time_string += ` (${PreTexts.getText('time_utc')}${utc_offset > 0 ? '+' : ''}${utc_offset})`;
            }
        }
    
        return local_time_string;
    }
    
    static getBuildPatchInfo() {
        let build_info_text = _getenv("app.id");
    
        build_info_text += ":" + _getenv("build.number") + " ";
        let patch_version = _getenv("patch.version", "0");
        const patch_version_str = _getenv("patch.version.string");
        const patch_version_xcent = _getenv("xcent.patch.version");
    
        console.log("patch_version_str", patch_version_str);
        if (patch_version_str) {
            try {
                let patch_version_str_obj = JSON.parse(patch_version_str);
                if (patch_version_str_obj) {
                    for (let key in patch_version_str_obj) {
                        if (patch_version_str_obj[key]) {
                            build_info_text += key.slice(0, 1).toUpperCase() + ":" + patch_version_str_obj[key] + " ";
                        }
                    }
                }
            } catch (e) {}
        } else {
            // 이 경우 patch 가 시작되지 않은 상황일 수도 있다.
            let patch_version_res = Util._patchpack_version_cache["res"];
            if (patch_version_res == undefined) {
                patch_version_res = _patchpack_version("res");
                Util._patchpack_version_cache["res"] = patch_version_res;
                console.log("patch_version_res", patch_version_res)
            }
            let patch_version_text = Util._patchpack_version_cache["text"];
            if (patch_version_text == undefined) {
                patch_version_text = _patchpack_version("text");
                Util._patchpack_version_cache["text"] = patch_version_text;
                console.log("patch_version_text", patch_version_text)
            }
            let patch_version_media = Util._patchpack_version_cache["media"];
            if (patch_version_media == undefined) {
                patch_version_media = _patchpack_version("media");
                Util._patchpack_version_cache["media"] = patch_version_media;
                console.log("patch_version_media", patch_version_media)
            }
            if (patch_version_res > 0) {
                build_info_text += "R:" + patch_version_res + " ";    
                if (patch_version_media > 0) {
                    build_info_text += "M:" + patch_version_media + " ";
                }
                if (patch_version_text > 0) {
                    build_info_text += "T:" + patch_version_text + " ";
                }
            } else {
                build_info_text += "patch:" + patch_version + " ";
            }
        }
        if (patch_version_xcent) {
            build_info_text += "X:" + patch_version_xcent + " ";
        }
    
        const user_lang = Util.getUserLanguage().trim();
        const patch_local_lang = _getenv("patch.local.lang");
        const os_lang = _getenv("os.lang");
    
        build_info_text += "t:";
        if (user_lang) {
            build_info_text += user_lang.trim() + " ";
        } else {
            build_info_text += "_";
        }
        build_info_text += "m:";
        if (patch_local_lang) {
            build_info_text += patch_local_lang.trim() + " ";
        } else {
            build_info_text += "_";
        }
        build_info_text += "o:";
        if (os_lang) {
            build_info_text += os_lang.trim() + " ";
        } else {
            build_info_text += "_";
        }

        const user_world = Util.getSelectedWorld()
        build_info_text += "w:" + user_world.toLowerCase() + " ";
    
        return build_info_text
    }

    static isPermissionChecked() {
        const permission_checked = cc.UserDefault.getInstance().getStringForKey("permission_checked");
        if (permission_checked && permission_checked == "1") {
            return true;
        }
        return false;
    }

    static setPermissionChecked(is_checked) {
        cc.UserDefault.getInstance().setStringForKey("permission_checked", is_checked ? "1" : "0");
    }

    static isPublisherLoginHistoryExists() {
        const publisher_login_history = cc.UserDefault.getInstance().getStringForKey("publisher_login_history");
        if (publisher_login_history && publisher_login_history == "1") {
            return true;
        }
        return false;
    }

    static setPublisherLoginHistory(is_exists) {
        cc.UserDefault.getInstance().setStringForKey("publisher_login_history", is_exists ? "1" : "0");
    }

    static getAllowedWorlds() {
        const allowed_worlds = [];
        if (`${_getenv("app.pubid")}` == "xcent") {
            allowed_worlds.push("CHINA");
            if (`${_getenv("world.debug")}` == "true") {
                allowed_worlds.push("GLOBAL");
                allowed_worlds.push("ASIA");
            }
        } else {
            allowed_worlds.push("GLOBAL");
            allowed_worlds.push("ASIA");
        }
        return allowed_worlds;
    }

    static isWorldUserSelected() {
        let user_selected_world = cc.UserDefault.getInstance().getStringForKey("world_region_selected");
        if (user_selected_world && user_selected_world == "1") {
            return true;
        }
        return false;
    }

    static setWorldUserSelected(is_selected) {
        cc.UserDefault.getInstance().setStringForKey("world_region_selected", is_selected ? "1" : "0");
    }
    
    static getSelectedWorld() {
        const allowed_worlds = Util.getAllowedWorlds();

        let selected_world = cc.UserDefault.getInstance().getStringForKey("world_region_key");
        if (selected_world) {
            if (`${_getenv("world.debug")}` == "true") {
                // 만약 world.debug 가 켜져 있다면 CHINA 서버를 선택 했었어도 무시
                selected_world = "";
            }
            if (allowed_worlds.includes(selected_world)) {
                return selected_world;
            }
        }

        selected_world = "GLOBAL";

        let os_lang = _getenv("os.lang");

        switch (os_lang) {
            case "ko":
            case "ja":
            case "zh-CN":
            case "zh-TW":
            case "zhs":
            case "zht":
                {
                    if (allowed_worlds.includes("ASIA")) {
                        selected_world = "ASIA";
                    }
                }
                break;
            default:
                selected_world = "GLOBAL";
                break;
        }

        if (`${_getenv("app.pubid")}` == "xcent") {
            selected_world = "CHINA";
            if (`${_getenv("world.debug")}` == "true") {
                selected_world = "ASIA";
            }
        }

        console.log("world selected as default : ", selected_world);

        return selected_world;
    }

    static getAllowedVoices() {
        const allowed_voices = [];
        if (`${_getenv("app.pubid")}` == "xcent") {
            allowed_voices.push("zhs");
            allowed_voices.push("ja");
        } else if (_getenv("os.lang") == "ko") {
            allowed_voices.push("ko");
            allowed_voices.push("ja");
            if (_getenv("voice.debug", false)) {
                allowed_voices.push("zhs");
            }
        } else {
            allowed_voices.push("ja");
            allowed_voices.push("ko");
            if (_getenv("voice.debug", false)) {
                allowed_voices.push("zhs");
            }
        }

        return allowed_voices;
    }

    static getAllowedLanguages() {
        const allowed_languages = [];
        allowed_languages.push("ja");
        allowed_languages.push("en");
        allowed_languages.push("ko");

        return allowed_languages;
    }    

    static getSelectedVoice() {
        const allowed_voices = Util.getAllowedVoices();
        let selected_voice = cc.UserDefault.getInstance().getStringForKey("voice_region_key");
        if (selected_voice) {
            if (allowed_voices.includes(selected_voice)) {
                return selected_voice;
            }
        }

        return "";
    }

    static getDefaultVoice() {
        const allowed_voices = Util.getAllowedVoices();
        return allowed_voices[0];
    }

    static setSelectedVoice(voice) {
        cc.UserDefault.getInstance().setStringForKey("voice_region_key", voice);
        _setenv("patch.local.lang", voice);
    }

    static setSelectedWorld(world) {
        console.log( '[pre step] 1. setSelectedWorld' , world )
        console.log('setSelectedWorld : ', world)
        console.log('review_mode: ', _getenv("review_mode", false));

        cc.UserDefault.getInstance().setStringForKey("world_region_key", world);
        if (`${_getenv("stove.enable")}` == "true") {
            const world_prefix = `${_getenv("stove.world_prefix")}`
            _setenv("stove.world_id", `${world_prefix}_${world.toLowerCase()}`);
            console.log('setSelectedWorld Stove : ', _getenv("stove.world_id"))
        }
        _setenv("world.id", world.toLowerCase());
    }

    static updateFinalEnvironment() {
        console.log( '[pre step] 3. updateFinalEnvironment' )            
        console.log( '[pre step] 3. review_mode: ', _getenv("review_mode", false));
        console.log( '[pre step] 3. stove.world_id: ', _getenv("stove.world_id", ""));

        if (`${_getenv("stove.enable")}` == "true") {
            if (_getenv("review_mode", false)) {
                _setenv("stove.world_id", `world_review`);
            }
            console.log('[pre step] 3.updateFinalEnvironment Stove : ', _getenv("stove.world_id"))
        }    
    }

    static getUserLanguage()
    {
        let lang = _getenv( 'user.lang', 'en' )
        if (lang == "zh") {
            lang = "zhs";
        }
        return lang
    }

    static getOsLanguage() {
        if (_getenv("tgs", false)) {
            return "ja";
        }
        const os_lang = _getenv("os.lang", "en");
        return os_lang;
    }

    static getPublisher() {
        if (`${_getenv("stove.enable")}` == "true") {
            return "stove";
        }
        if (`${_getenv("xcent.enable")}` == "true") {
            return "xcent";
        }
        return "";
    }

    static setPreFileFilter()
    {
        cc.FileUtils.getInstance().setLocaleCode( Util.getUserLanguage() )
        let pubid = _getenv( 'app.pubid' )
        if (pubid != '') {
            console.log( '_set_pre_file_filter publisher id :', pubid, "lang :", Util.getUserLanguage())
            cc.FileUtils.getInstance().setPublisherId( pubid )
            cc.FileUtils.getInstance().addLocaleFilter( 'font' , '{name}_{loc}{ext}|{name}_{pubid}{ext}' ) // font/main_xcent.font / font/main_ja.font
            cc.FileUtils.getInstance().addLocaleFilter( 'ui' , '{name}_{pubid}{ext}|{name}_{loc}{ext}' ) // ui/sg_xcent.png / ui/sg.png
        } else {
            cc.FileUtils.getInstance().addLocaleFilter( 'font' , '{name}_{loc}{ext}' ) // font/daum_ja.db <--추가.
        }
    }

    static registerEventListener(key, eventListener)
    {
        if (this._event_listeners[key]) {
            cc.Director.getInstance().getEventDispatcher().removeEventListener(this._event_listeners[key]);
        }
        this._event_listeners[key] = eventListener;
        let custom_event_listener = cc.EventListenerCustom.create(key, eventListener);
        cc.Director.getInstance().getEventDispatcher().addEventListenerWithFixedPriority(custom_event_listener, 1);
    }

}
exports.Util = Util;
