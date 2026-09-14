'use strict';

Object.defineProperty(exports, "__esModule", { value: true });

const { PubBase } = require( './publisher_base.js' )
const { Util } = require( './util.js' )

class PublisherXcent extends PubBase
{
    installed_qq = false;
    installed_wechat  = false;

    constructor()
    {
        super();
    }

    isAppInstalled( app_name ) {
        const app_name_lower = app_name.toLowerCase();
        if( app_name_lower === "qq" ) {
            return this.installed_qq;
        } else if( app_name_lower === "wechat" ) {
            return this.installed_wechat;
        }
        return false;
    }

    async initialize()
    {
        try {
            const result = await PubBase.invokeEXI("xcent/initialize", {});
            this.initialize_result = result;

            this.installed_qq = result?.installed_qq || false;
            this.installed_wechat = result?.installed_wechat || false;

            return { result: true, error: null };
        } catch (error) {
            console.error("PublisherXcent.initialize error:", error);
            return { result: false, error: error };
        }
    }

    async login(type)
    {
        let login_type = "loginAuto";
        if (type) {
            login_type = type;
        }
        try {
            const result = await PubBase.invokeEXI(`xcent/${login_type}`, {});
            const return_response = result.res;
            const return_code = result.retCode;
            console.log(`PublisherXcent.login(${login_type}) result : `, JSON.stringify(result))
            if (return_response != "ok" || return_code != 0) {
                throw new Error(JSON.stringify(result));
            }
            this.login_result = result;
            let publisher_open_id = result.open_id;
            if (!publisher_open_id) {
                publisher_open_id = result.openID;
            }
            if (publisher_open_id) {
                publisher_open_id = publisher_open_id.toString();
            }
            console.log('publisher_open_id : ', publisher_open_id)
            this.publisher_uid = publisher_open_id;
            if (this.onLoginSuccessCallback) {
                Util.setPublisherLoginHistory(true);
                this.onLoginSuccessCallback();
            } else {
                console.error(`PublisherXcent.login(${login_type}) success, but no callback registered`)
            }
            return true;
        } catch (error) {
            console.error(`PublisherXcent.login(${login_type}) error:`, error);
            if (this.onLoginFailedCallback) {
                this.onLoginFailedCallback();
            } else {
                console.error(`PublisherXcent.login(${login_type}) failed, but no callback registered`)
            }
            return false;
        }
    }
}

exports.PubXcent = PublisherXcent;
