// application_change_resolution

const WIDGET_DESIGN_WIDTH = 1280;
const WIDGET_DESIGN_HEIGHT = 720;
const SCENE_DESIGN_WIDTH = 1280;
const SCENE_DESIGN_HEIGHT = 720;

class ResolutionHandler {
    static instance = null;
    static eventListener = null;

    delegates = []; // {ref: node, func: function(newWidth, newHeight)}

    constructor() {
        if (!ResolutionHandler.instance) {
            ResolutionHandler.instance = this;
        }
        return ResolutionHandler.instance;
    }
    static getInstance() {
        if (!ResolutionHandler.instance) {
            ResolutionHandler.instance = new ResolutionHandler();
            ResolutionHandler.instance.init();
        }
        return ResolutionHandler.instance;
    }

    static destroyInstance() {
        if (ResolutionHandler.instance) {
            if (ResolutionHandler.eventListener) {
                cc.Director.getInstance().getEventDispatcher().removeEventListener(ResolutionHandler.eventListener);
            }
            ResolutionHandler.instance = null;
        }
    }

    init() {
        const key = "application_change_resolution";
        ResolutionHandler.eventListener = cc.EventListenerCustom.create(key, this.onResolutionChange.bind(this));
        cc.Director.getInstance().getEventDispatcher().addEventListenerWithFixedPriority(ResolutionHandler.eventListener, 1);
    }

    alignCenter(node) {
        if (!node || !_get_cocos_refid(node)) return;
        const win_size = cc.Director.getInstance().getWinSize();
        node.setAnchorPoint(0.5, 0.5);
        node.setPosition(win_size.width / 2, win_size.height / 2);
        this.addDelegate({
            ref: node,
            func: (newWidth, newHeight) => {
                node.setPosition(newWidth / 2, newHeight / 2);
            }
        });
    }

    addDelegate(delegate) {
        this.delegates.push(delegate);
    }

    onResolutionChange(event) {
        if (!this.delegates || this.delegates.length === 0) return;
        const win_size = cc.Director.getInstance().getWinSize();
        const newWidth = win_size.width;
        const newHeight = win_size.height;
        if (newWidth <= 0 || newHeight <= 0) return;

        // 기존 메인 스크립트에 있는 application_change_resolution이 하는 역할들 수행.
        // 1. 씬의 루트 레이어의 위치를 레터박스 고려한 위치로 재설정.
        // 2. 모든 ui의 유저데이터 재처리.
        // 3. 리얼라인 처리.
        this.updateResolution();

        // delegate 중에 이미 해제된 노드가 있으면 제거.
        this.delegates = this.delegates.filter(delegate => {
            return !!_get_cocos_refid(delegate.ref);
        });
        // 일괄적으로 처리 안되는 녀석들은 각 delegate 호출.
        this.delegates.forEach(delegate => {
            delegate.func(newWidth, newHeight);
        });
    }

    updateResolution() {
        ResolutionHandler._winSize = cc.Director.getInstance().getWinSize();
        ResolutionHandler._safeAreaRect = cc.Director.getInstance().getSafeAreaRect();

        //안드로이드 좌우가 다름 ios 처럼 좌우 동일하게 맞춤
        if (ResolutionHandler._safeAreaRect.x == 0) {
            if (ResolutionHandler._safeAreaRect.width > WIDGET_DESIGN_WIDTH) {
                if (ResolutionHandler._safeAreaRect.width < ResolutionHandler._winSize.width) {
                    //zfold 는 width 해상도가 디자인 해상도 width 보다 작게 나와서 이슈 있음
                    ResolutionHandler._safeAreaRect.x = ResolutionHandler._winSize.width - ResolutionHandler._safeAreaRect.width;
                    cc.Director.getInstance().setDisplayStatsOffSetPos({
                        x: ResolutionHandler._safeAreaRect.x,
                        y: 0,
                    });
                }
            }
        } else {
            if (ResolutionHandler._safeAreaRect.width > WIDGET_DESIGN_WIDTH) {
                cc.Director.getInstance().setDisplayStatsOffSetPos({
                    x: ResolutionHandler._safeAreaRect.x,
                    y: 0,
                });
            } else {
                ResolutionHandler._safeAreaRect.x = 0;
            }
        }
        if (_getenv("notch")) {
            let notch_x = _getenv("notch");
            const temp_width = ResolutionHandler._safeAreaRect.width - Number(notch_x || 0) * 2.0;
            const notch = temp_width < 1280 ? 0 : (ResolutionHandler._safeAreaRect.width - temp_width) / 2.0;
            ResolutionHandler._safeAreaRect.x = notch;
            cc.Director.getInstance().setDisplayStatsOffSetPos({
                x: ResolutionHandler._safeAreaRect.x,
                y: 0,
            });
        }
        if (ResolutionHandler._safeAreaRect.y == 0) {
            if (ResolutionHandler._safeAreaRect.height < ResolutionHandler._winSize.height) {
                ResolutionHandler._safeAreaRect.y = ResolutionHandler._winSize.height - ResolutionHandler._safeAreaRect.height;
            }
        }
        ResolutionHandler._letterWidth = (ResolutionHandler._winSize.width - SCENE_DESIGN_WIDTH) / 2;
        ResolutionHandler._letterHeight = (ResolutionHandler._winSize.height - SCENE_DESIGN_HEIGHT) / 2;

        this.onResolutionChanged(cc.Director.getInstance().getRunningScene());
    }

    onResolutionChanged(node/*: cc.Node*/) {
        for (const child of node.getChildren()) {
            if (!_get_cocos_refid(child)) continue;
            const class_type = ResolutionHandler._cctype(node);
            const first_user_data = ResolutionHandler._getUserData(node)[0];
            if (first_user_data == "FILL_LEFT" || first_user_data == "FILL_RIGHT" || first_user_data == "FILL_CENTER") {
                ResolutionHandler._realignDim(node, first_user_data);
            } else if (class_type == "ccui.Widget" || class_type == "cc.Node") {
                switch (node.getName().toUpperCase()) {
                    case "TEMP_LEFT":
                    case "LEFT":
                    case "RIGHT":
                    case "TOP":
                    case "BOTTOM":
                    case "FIT":
                    case "LEFT_IGNORE_NOTCH":
                    case "RIGHT_IGNORE_NOTCH":
                        ResolutionHandler._realign(node, node.getName());
                        break;
                }
            }
            this.onResolutionChanged(child);
        }
    }

    static _getUserData(sender/*: cc.Node*/)/*: string[]*/ {
        if (!sender) return [];
        if (sender._userdata != undefined) return sender._userdata;
        let ret/*: string[]*/ = [];
        let com_ext = sender.getComponent("ComExtensionData")/* as cc.ComExtensionData*/;
        if (!com_ext) return ret;
        com_ext = _type_cast(com_ext, cc.ComExtensionData);
        let ud/*: string*/ = com_ext.getCustomProperty();
        if (!com_ext) return ret;
        if (!ud) return ret;
        let tokens/*: string[]*/ = ud.split("|");
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token && token != "") {
                ret.push(token);
            }
        }
        return ret;
    }
    static _realignDim(node/*: cc.Node*/, align/*: string*/) {
        let pos = node.getWorldPosition();
        const comp = node.getComponent("__ui_layout")/* as ccui.LayoutComponent*/;
        if ("FILL_LEFT" == align.toUpperCase()) {
            node.setContentSize({
                width: (pos[0] >= 0 ? pos[0] : (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.width : 0) - Math.abs(pos[0])) + (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.x : 0),
                height: node.getContentSize().height,
            });
            comp.refreshLayout();
            return;
        }
        if ("FILL_RIGHT" == align.toUpperCase()) {
            node.setContentSize({
                width: (pos[0] >= 0 ? (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.width : 0) - pos[0] : Math.abs(pos[0])) + (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.x : 0),
                height: node.getContentSize().height,
            });
            comp.refreshLayout();
            return;
        }
        if ("FILL_CENTER" == align.toUpperCase()) {
            node.setContentSize({
                width: (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.width : 0) + (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.x * 2 : 0),
                height: node.getContentSize().height,
            });
            comp.refreshLayout();
            return;
        }
    }
    static _realign(node/*: cc.Node*/, align/*: string*/) {
        if (!ResolutionHandler._winSize) return;
        if ("LEFT" == align.toUpperCase() || "TEMP_LEFT" == align.toUpperCase()) {
            // if (this.isHorizontalResolution()) 실시간 창 크기 조절 대응으로 주석처리
            node.setPositionX(-ResolutionHandler._letterWidth + (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.x : 0));
            return;
        }
        if ("LEFT_IGNORE_NOTCH" == align.toUpperCase()) {
            // if (this.isHorizontalResolution()) 실시간 창 크기 조절 대응으로 주석처리
            node.setPositionX(-ResolutionHandler._letterWidth);
            return;
        }
        if ("RIGHT" == align.toUpperCase()) {
            // if (this.isHorizontalResolution()) 실시간 창 크기 조절 대응으로 주석처리
            node.setPositionX(ResolutionHandler._letterWidth - (ResolutionHandler._safeAreaRect ? ResolutionHandler._safeAreaRect.x : 0));
            return;
        }
        if ("RIGHT_IGNORE_NOTCH" == align.toUpperCase()) {
            // if (this.isHorizontalResolution()) 실시간 창 크기 조절 대응으로 주석처리
            node.setPositionX(ResolutionHandler._letterWidth);
            return;
        }
        // 이 부분은 풀스크린 대응할때 챙겨야함. (우선은 레터박스 전체 통일시켜 먹임)
        if ("TOP" == align.toUpperCase()) {
            return;
        }
        // 이 부분은 풀스크린 대응할때 챙겨야함. (우선은 레터박스 전체 통일시켜 먹임)
        if ("BOTTOM" == align.toUpperCase()) {
            return;
        }
    }
    static _cctype(ref) {
        let ret = typeof ref;
        if ("object" != ret) return ret;
        if (ref == null) return "null";
        if ("function" != typeof ref.constructor) return ret;
        let classname = ref.constructor.name;
        if ((globalThis).cc[classname]) return "cc." + classname;
        if ((globalThis).ccui[classname]) return "ccui." + classname;
        if ((globalThis).sp[classname]) return "sp." + classname;
        return classname;
    }
}

exports.ResolutionHandler = ResolutionHandler;

