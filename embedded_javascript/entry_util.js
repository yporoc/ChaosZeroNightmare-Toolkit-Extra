'use strict';

Object.defineProperty(exports, "__esModule", { value: true });

const { PreTexts } = require( './pre_data.js' )
const { Util } = require( './util.js' )

class EntryUtil {
    
    // return boolean
    static isValidVersionInfo(version_json) {
        if( version_json && version_json['_appid'] && version_json['world'] ) {
            return true
        }
        console.error('isValidVersionInfo : version_json is not valid')
        return false
    }

    static isValidTargetVersionInfo(target_version_info) {
        if ( target_version_info && target_version_info['verinfo.status'] ) {
            return true;
        }
        console.error('isValidTargetVersionInfo : target_version_info is not valid')
        return false;
    }

    // return object
    static getTargetVersionInfo(version_json) {
        console.log('getTargetVersionInfo')
        if (!EntryUtil.isValidVersionInfo(version_json)) {
            console.log('version_json is not valid')
            return {};
        }
        const user_world = Util.getSelectedWorld();
        console.log('user_world : ', user_world)
        const world_version_info = version_json['world'][user_world.toLowerCase()] ?? {};
        if (!world_version_info || !world_version_info['live']) {
            console.log('world_version_info is not valid')
            return {};
        }
        if (!world_version_info['review']) {
            console.log('review data is not valid, use live')
            return world_version_info['live'];
        }
        const user_build_version = Number(_getenv('build.number', 0));
        console.log('user_build_version : ', user_build_version)
        const live_build_version = Number(world_version_info['live']['build.version'] ?? -1);
        const review_build_version = Number(world_version_info['review']['build.version'] ?? -1);
        console.log('live_build_version : ', live_build_version)
        console.log('review_build_version : ', review_build_version)
        
        if (_getenv('force_review') == 'true' || _getenv('force_review') == '1') {
            console.log('force_review is true')
            _setenv("review_mode", "true");
            return world_version_info['review'];
        } else if (_getenv('force_live') == 'true' || _getenv('force_live') == '1') {
            console.log('force_live is true')
            return world_version_info['live'];
        } 
        
        if (user_build_version === review_build_version) {
            console.log('review is true')
            _setenv("review_mode", "true");
            return world_version_info['review'];
        } else {
            return world_version_info['live'];
        }
    }

    // return boolean
    static isAppUpgrade(target_version_info) {
        if (!target_version_info) return false;
        if (!EntryUtil.isValidTargetVersionInfo(target_version_info)) return false;
        const user_build_version = _getenv('build.number', 0);
        const target_build_version = target_version_info['build.version'] ?? -1;
        if (user_build_version < target_build_version) {
            return true;
        }
        return false;
    }

    // return array
    static getPrePatchData(target_version_info) {
        if (!EntryUtil.isValidTargetVersionInfo(target_version_info)) return false;
        const patch_enable = `${_getenv('patch.enable')}`
        console.log('patch_enable :', patch_enable)
        if (patch_enable !== 'true') {
            console.log('patch is disabled')
            return [];
        } 
        console.log('patch is enabled')
        let version_pre_data = [];
        // cdn.version으로 시작하고 .pre로 끝나는 모든 키를 찾아서 확인
        for (let key in target_version_info) {
            if (key.startsWith('cdn.version_') && key.endsWith('.pre')) {
                let value = Number(target_version_info[key]);
                if (value > 0) {
                    version_pre_data.push({
                        key: key.slice(), // 문자열 복사
                        value: value // 숫자는 원시값이라 그대로 복사됨
                    });
                }
            }
        }
        
        return version_pre_data;
    }

    static isPrePatchNeeded(target_version_info) {
        console.log('check_pre_patch')
        if (!EntryUtil.isValidTargetVersionInfo(target_version_info)) return false;

        const version_pre_data = EntryUtil.getPrePatchData(target_version_info)
        console.log('version_pre_data : ', JSON.stringify(version_pre_data))

        let local_patch_version = _patchpack_version("*");
        console.log('local_patch_version : ', local_patch_version)
        let is_pre_patch_needed = false;
        for (let i = 0; i < version_pre_data.length; i++) {
            let pre_data = version_pre_data[i]
            console.log('policy_key : ', pre_data.key, ' local patch version : ', local_patch_version, ' remote patch version : ', pre_data.value)
            if (!local_patch_version || local_patch_version < pre_data.value) {
                is_pre_patch_needed = true;
            }
        }
        return {is_pre_patch_needed, version_pre_data};
    }

    static isMaintenance(version_json) {
        if (!EntryUtil.isValidVersionInfo(version_json)) return false;
        const user_world = Util.getSelectedWorld();
        const maintenance_list = version_json['maintenance'] ?? [];

        // return {
        //     id: 1234,
        //     world: user_world,
        //     update_time: 1756286354,
        //     start_time: 1756286354,
        //     end_time: 1796286354,
        //     title: "점검 안내",
        //     msg: "점검 내용",
        //     url_notice: "https://www.google.com",
        //     url_patch_note: "https://www.google.com",
        //     url_sns: "https://www.google.com",
        // }


        if (maintenance_list.length == 0) return false;
        for (let i = 0; i < maintenance_list.length; i++) {
            const maintenance_info = maintenance_list[i];
            if (maintenance_info['world'] == user_world.toLowerCase()) {
                console.log('maintenance : ', maintenance_info['title'], maintenance_info['start_time'], maintenance_info['end_time'])
                return maintenance_info;
            }
        }
        return false;
    }
}
exports.EntryUtil = EntryUtil;
