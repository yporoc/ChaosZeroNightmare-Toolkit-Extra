'use strict';

Object.defineProperty(exports, "__esModule", { value: true });

class PublisherBase {

    initialize_result = undefined;
    login_result = undefined;
    publisher_uid = undefined;
    onLoginSuccessCallback = undefined;
    onLoginFailedCallback = undefined;

    constructor()
    {
    }

    isAppInstalled( app_name ) {
        console.error("PublisherBase.isAppInstalled not implemented:"+ app_name);
        return false;
    }

    async initialize()
    {
        console.error("PublisherBase.initialize not implemented");
        return { result: false, error: new Error("PublisherBase.initialize not implemented") };
    }

    async login(login_type)
    {
        console.error(`PublisherBase.login(${login_type}) not implemented`);
        return false;
    }

    setOnLoginSuccessCallback(callback) {
        this.onLoginSuccessCallback = callback;
    }

    setOnLoginFailedCallback(callback) {
        this.onLoginFailedCallback = callback;
    }

    static async invokeEXI(type, jdata)
    {
        const result = await new Promise(function (resolve, reject) {
            console.log(`[ExternalInterface] invoke ${type} with data:`, jdata);
            _external_interface_invoke(type, JSON.stringify(jdata), function (msg) {
                try {
                    const result = JSON.parse(msg);
                    console.log(`[ExternalInterface] invoke got result:`, msg);
                    if (result.result !== undefined) {
                        if (!result.result) {
                            reject(new Error(msg));
                        }
                    }
                    resolve(result);
                } catch (error) {
                    console.error(`[ExternalInterface] invoke got error:`, error);
                    reject(new Error(msg));
                }
            });
        });
        console.log("[ExternalInterface] invoke completed", type, JSON.stringify(result));
        return result;
    }
}

exports.PubBase = PublisherBase;
