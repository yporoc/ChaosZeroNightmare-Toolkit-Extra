'use strict';

Object.defineProperty(exports, "__esModule", { value: true });

const { PubBase } = require( './publisher_base.js' )
const { Util } = require( './util.js' )

class PublisherStove extends PubBase
{
    constructor()
    {
        super();
    }

    async initialize()
    {
        _ad_custom_event('singular', 'auth_initialize_start', '0', _getenv("stove.world_id", ''), '')
        try {
            const result = await PubBase.invokeEXI("stove/initialize", {});
            this.initialize_result = result;
            _ad_custom_event('singular', 'auth_initialize_succes_end', '0', _getenv("stove.world_id", ''), '')
            return { result: true, error: null };
        } catch (error) {
            _ad_custom_event('singular', 'auth_initialize_fail_end', '0', _getenv("stove.world_id", ''), '')
            console.error("PublisherStove.initialize error:", error);
            return { result: false, error: error };
        }
    }

    async login(type)
    {
        let login_type = "login";
        if (type) {
            login_type = type;
        }
        _ad_custom_event('singular', 'authui_login_start', '0', _getenv("stove.world_id", ''), '')
        try {
            const result = await PubBase.invokeEXI(`stove/${login_type}`, {});
            this.login_result = result;
            // stove 에서 guid 대신 memberNumber 
            const publisher_member_number = result.accessToken.user.memberNumber.toString();
            const publisher_guid = result.accessToken.user.userId.toString();
            console.log('publisher_member_number : ', publisher_member_number)
            console.log('publisher_guid : ', publisher_guid)
            this.publisher_uid = publisher_member_number;
            _setenv("stove.user_id", String(publisher_guid))
            _ad_custom_event('singular', 'authui_login_succes_end', String(publisher_guid), _getenv("stove.world_id", ''), '')
            if (this.onLoginSuccessCallback) {
                Util.setPublisherLoginHistory(true);
                this.onLoginSuccessCallback();
            } else {
                console.error(`PublisherStove.login(${login_type}) success, but no callback registered`)
            }
            return true;
        } catch (error) {
            console.error(`PublisherStove.login(${login_type}) error:`, error);
            _ad_custom_event('singular', 'authui_login_fail_end', '0', _getenv("stove.world_id", ''), '')
            if (this.onLoginFailedCallback) {
                this.onLoginFailedCallback();
            } else {
                console.error(`PublisherStove.login(${login_type}) failed, but no callback registered`)
            }
            return false;
        }
    }
}

exports.PubStove = PublisherStove;
