'use strict';

Object.defineProperty(exports, "__esModule", { value: true });
const bootres = require( './bootres.js' )
const { Util } = require( './util.js' )
const { ResolutionHandler } = require('./resolution.js');

class TitleBackground
{
	constructor()
	{
		this.playingMovieUrl = ""
	}

	show( parent )
	{
		if( _get_cocos_refid( this.scene ) )
		{
			this.scene.ejectFromParent()
			parent.addChildFirst( this.scene )

			let self = this;
			let application_did_enter_background_listener = function(event) {
				console.log("[pre] application_did_enter_background")
				cc.Director.getInstance().setNextDeltaTimeZero(true);
				self.movieResume(false)
			}
			Util.registerEventListener('application_did_enter_background', application_did_enter_background_listener)

			let application_will_enter_foreground_listener = function(event) {
				console.log("[pre] application_will_enter_foreground")
				cc.Director.getInstance().setNextDeltaTimeZero(true);
				self.movieResume(true)
			}
			Util.registerEventListener('application_will_enter_foreground', application_will_enter_foreground_listener)

			let application_will_resign_active_listener = function(event) {
				console.log("[pre] application_will_resign_active")
				cc.Director.getInstance().setNextDeltaTimeZero(true);
				self.movieResume(false)
			}
			Util.registerEventListener('application_will_resign_active', application_will_resign_active_listener)

			let application_did_become_active_listener = function(event) {
				console.log("[pre] application_did_become_active")
				cc.Director.getInstance().setNextDeltaTimeZero(true);
				self.movieResume(true)
			}
			Util.registerEventListener('application_did_become_active', application_did_become_active_listener)
		}
	}

	hide()
	{
		if( _get_cocos_refid( this.scene ) )
		{
			this.scene.removeFromParent()
		}
		this.scene = undefined
	}

	isMoviePlay = false
	video_player = null
	moviePlay(is_first_patch)
	{
		if( this.isMoviePlay ) return
		this.isMoviePlay = true

		let pv_url = ""
		const patch_enable = `${_getenv("patch.enable")}`
		console.log('patch_enable : ', patch_enable)
		if (patch_enable !== "true") {
			console.log('patch.enable is false, use title_movie_cdn')
			// dev 등 개발 클라인 경우
			pv_url = _getenv( 'title_movie_cdn' , "" )
		} else {
			if (is_first_patch) {
				pv_url = _getenv( 'title_movie_cdn_first' , "" )
				// 만약 title_movie_cdn_first 가 없으면 title_movie_cdn 을 사용
				if (pv_url.trim() == "") {
					pv_url = _getenv( 'title_movie_cdn' , "" )
					console.log('title_movie_cdn_first is empty, use title_movie_cdn')
				} else {
					console.log('title_movie_cdn_first is not empty, use title_movie_cdn_first')
				}
			} else {
				pv_url = _getenv( 'title_movie_cdn' , "" )
				console.log('use title_movie_cdn')
			}
		}
		if (pv_url.trim() == "") {
			pv_url = "title_terrascion"
			console.log('pv_url is empty, use title_terrascion')
		}
		let winSize = cc.Director.getInstance().getWinSize()

		// check pv_url startswith http and contains .mp4
		if (pv_url.startsWith("http") && pv_url.indexOf(".mp4") > 0) {
			let bgMov = ccui.VideoPlayer.create()
			this.playingMovieUrl = pv_url
			if (bgMov.getChildren().length > 0) {
				let child = bgMov.getChildren()[0]
				child.setOpacity(0)
				child.runAction(cc.Sequence.create(
					cc.FadeIn.create( 1 ),
				))
			}
			bgMov.setName('movie_title')
			bgMov.setFileName(pv_url)
			bgMov.setLoop(true)
			bgMov.setAnchorPoint( 0.5, 0.5 )
			bgMov.setPosition( winSize.width/2, winSize.height/2 )
            this.adjustTitleMovieScale(bgMov, this.scene)		
			ResolutionHandler.getInstance().addDelegate({
				ref: bgMov,
				func: (newWidth, newHeight) => {
					bgMov.setPosition( newWidth/2, newHeight/2 );
					this.adjustTitleMovieScale(bgMov, this.scene);
				}
			});
			bgMov.play()

            let master_volume = cc.UserDefault.getInstance().getFloatForKey("master_volume", 100) / 100;
            let bgm_volume = cc.UserDefault.getInstance().getFloatForKey("bgm_volume", 100) / 100;
            let master_mute = cc.UserDefault.getInstance().getStringForKey("master_paused", "off");
            let bgm_mute = cc.UserDefault.getInstance().getStringForKey("bgm_paused", "off");
            if (master_mute == "on") master_volume = 0;
            if (bgm_mute == "on") bgm_volume = 0;
            bgMov.setVolume(bgm_volume * master_volume); // 이전에 설정해놓은 BGM * Master volume 적용, 
			bgMov.setPreLoadSeconds(1)
            this.video_player = bgMov;
			this.scene.addChildFirst(bgMov)	
		} else {
			if (!pv_url.startsWith("http")) {
				if (!pv_url.endsWith(".sct")) {
					pv_url += ".sct"
				}
				pv_url = 'ui/' + pv_url;
			}
			console.log('pv_url(img): ', pv_url)

			let bgImg = cc.Sprite.create( pv_url )
			if (bgImg) {
				let bgSize = bgImg.getContentSize()
				if (bgSize.width > 0 && bgSize.height > 0) {
					console.log('bgSize: w:', bgSize.width, ' h:', bgSize.height)
					let scale = Math.max( winSize.width / bgSize.width, winSize.height / bgSize.height )
					bgImg.setScale( scale )
					console.log('scale: ', scale)
				}
				bgImg.setName( 'movie_title' )
				bgImg.setAnchorPoint( 0.5, 0.5 )
				bgImg.setPosition( winSize.width/2, winSize.height/2 )
				ResolutionHandler.getInstance().addDelegate({
					ref: bgImg,
					func: (newWidth, newHeight) => {
						bgImg.setPosition( newWidth/2, newHeight/2 );
					}
				});
				this.scene.addChildFirst(bgImg)
			} else {
				console.error('Failed to create title resource: ', pv_url)
			}
		}
	}

	getPlayingMovieUrl() {
		return this.playingMovieUrl
	}

	movieStop() {
		if (this.isMoviePlay) {
			this.isMoviePlay = false
			this.playingMovieUrl = ""
			this.video_player = null;
			const childs = this.scene.getChildren()
			for (let i = 0; i < childs.length; i++) {
				const child = childs[i]
				if (child && _get_cocos_refid(child)) {
					child.removeFromParent()
				}
			}
		}
	}

	movieResume(flag) {
		if (_get_cocos_refid(this.video_player)) {
			if (flag) {
				this.video_player.resume();
			} else {
				this.video_player.pause();
			}
		}
	}

	createScene()
	{
		if( _get_cocos_refid( this.scene ) ) return this.scene

		let winSize = cc.Director.getInstance().getWinSize()
		let safeAreaRect = cc.Director.getInstance().getSafeAreaRect()

		let scene = cc.Layer.create()
		scene.setContentSize(safeAreaRect)

		this.scene = scene

		return this.scene
	}

	/**
	* 타이틀 화면은 레터박스 부분까지 포함하여 랜더링 하기 때문에 사이즈가 다릅니다.
	* 타이틀 화면이 보여줄 최대 화면 사이즈를 제공합니다.
	* 타이틀 화면만 특수하게 상하단 레터박스 까지 게임화면이 랜더링 됩니다.
	*/	
	adjustTitleMovieScale( movie_node, parent )
	{
		let winSize = cc.Director.getInstance().getWinSize()
		let SCENE_DESIGN_HEIGHT = 720
		
		let TITLE_WIDTH 	= winSize.width
		let TITLE_HEIGHT 	= Math.min( SCENE_DESIGN_HEIGHT, winSize.height)

		let movie_node_size = movie_node.getContentSize()
		let s = TITLE_WIDTH / movie_node_size.width
		if ( TITLE_HEIGHT > SCENE_DESIGN_HEIGHT ) {
			s =  s * (TITLE_HEIGHT / SCENE_DESIGN_HEIGHT)
		}

		let parent_scale = parent ? parent.getScale() : 1
		movie_node.setScale( s / parent_scale )
		//console.log(`---------> ${s / parent_scale}`)
	}
}


exports.TitleBackground = TitleBackground
