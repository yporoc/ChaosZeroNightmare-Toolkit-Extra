'use strict';


Object.defineProperty(exports, '__esModule', { value: true });

require( './boot.js' )

cc.Device.setKeepScreenOn( true );




cc.GLProgramCache.getInstance().addGLProgramFromFile('ShaderDynamicBatch', 'shader/dynbat_def.vert', 'shader/dynbat_def.frag')


function getOrCreateSpriteFrame(name) 
{
	return cc.SpriteFrameCache.getInstance().getOrCreateSpriteFrame(name);
}

function getSprite(name) {
	let spriteFrame = getOrCreateSpriteFrame(name);
	if (!spriteFrame) {
		console.error('SpriteCache', 'getOrCreateSpriteFrame is no have sprite frame : ' + name);
		return;
	}
	let sprite = cc.Sprite.createWithSpriteFrame(spriteFrame);
	if (sprite) {
		sprite.setName(name);
		return sprite;
	}
	console.error('SpriteCache', 'createWithSpriteFrame is no have sprite frame : ' + name);
	return;
}

function getScale9Sprite(name) {
	let spriteFrame = getOrCreateSpriteFrame(name);
	if (!spriteFrame) {
		return;
	}
	let sprite = ccui.Scale9Sprite.createWithSpriteFrame(spriteFrame);
	if (sprite) {
		sprite.setName(name);
		return sprite;
	}
	return;
}


function resetSprite(sprite, name) {
	if (!sprite)
		return;
	return setSpriteTexture(sprite, getFrameName(name));
}

function setSpriteTexture(sprite, name) {
	if (!yuna.get_cocos_refid(sprite)) {
		return;
	}
	let spriteFrame = getOrCreateSpriteFrame(name);
	if (!spriteFrame) {
		return;
	}
	if (cc.type(sprite) == 'cc.Sprite') {
		let ccsprite = sprite;
		ccsprite.setSpriteFrame(spriteFrame);
	}
	//if( yuna.type(sprite) == 'ccui.Scale9Sprite' ){
	//    (<ccui.Scale9Sprite>sprite).setSpriteFrame(sprite)
	//if(spriteFrame['-rotation']) sprite.setRotation( spriteFrame['-rotation'] or 0 )
	//}
	if (cc.type(sprite) == 'ccui.ImageView') {
		let imageView = sprite;
		imageView.loadTexture(spriteFrame);
	}
}

function _random(min,max)
{
	return min + Math.floor(Math.random() * (max-min))
}
function _application_start_contents( event )
{

	
	cc.Director.getInstance().getEventDispatcher().removeEventListener( event.getEventListener() )

    let cocosScene      = cc.Scene.create()
	//_async_load_version_info()
	//print( 'create background layer ' )
	let layer      = cc.LayerColor.create( new cc.Color( 0 , 0, 255 , 255 ) )

	

	let uiDir = cc.FileUtils.getInstance().fullPathForFilename( 'sample_sprite/index.txt' )


	let images = []
	uiDir = uiDir.replace( '/index.txt' , '' )
	let filelist = _readdir( uiDir )
	filelist.forEach(function(element) {
		if( element.endsWith( '.sct' ) ){
			images.push( element )
		}
	});



	images.forEach(function(element) {
		let sprite = getSprite(element)
		if( sprite ) {
			sprite.setPosition( _random( 100, 1200 ) , _random( 100, 700 ) )
			layer.addChild(sprite)
		}
	});
	
	cocosScene.addChild( layer )	
	cc.Director.getInstance().runWithScene( cocosScene )


	//_start_title_scene();

}


cc.Director.getInstance().getEventDispatcher().addCustomEventListener( 'application_start_contents' , _application_start_contents )


