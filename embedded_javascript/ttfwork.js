'use strict';


Object.defineProperty(exports, '__esModule', { value: true });

require( './boot.js' )

cc.Device.setKeepScreenOn( true );


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

	


	let lines = _readfile( 'sample_text/text.tsv' )
	lines = lines.split('\n');
	


	for(let i = 0  ; i < 500 ; i ++ ){
		let default_label = cc.Label.createWithTTF( '', 'font/daum.ttf', 20 + _random(1,10))
		default_label.setString( lines[_random( 0 , lines.length - 1 )] )
		default_label.setPosition( _random( 100, 1200 ) , _random( 100, 700 ) )
	
		let outline_label = cc.Label.createWithTTF( '', 'font/daum.ttf', 20 +  _random(1,10))
		//outline_label.setColor( this.GUARD_COLOR_1, this.GUARD_COLOR_2)
		outline_label.enableOutline( new cc.Color(30,30,30, 255) , 1.5 )
		outline_label.setString( lines[_random( 0 , lines.length - 1 )] )
		outline_label.setPosition( _random( 100, 1200 ) , _random( 100, 700 ) )
		
	
		layer.addChild(default_label)
		layer.addChild(outline_label)	
	}

	cocosScene.addChild( layer )	
	cc.Director.getInstance().runWithScene( cocosScene )


	//_start_title_scene();

}


cc.Director.getInstance().getEventDispatcher().addCustomEventListener( 'application_start_contents' , _application_start_contents )


