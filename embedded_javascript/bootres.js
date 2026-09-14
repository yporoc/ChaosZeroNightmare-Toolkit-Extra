
var MODEL_GL_PROGRAM
var MODEL_GL_PROGRAM_STATE

var MODEL_GL_PROGRAM_BG
var MODEL_GL_PROGRAM_STATE_BG

var VERT_SHADER = `

attribute vec4 a_position;					
attribute vec2 a_texCoord;					
attribute vec4 a_color;						
#ifdef GL_ES								
varying lowp vec4 v_fragmentColor;			
varying mediump vec2 v_texCoord;			
#else										
varying vec4 v_fragmentColor;				
varying vec2 v_texCoord;					
#endif										
void main()
{
	gl_Position = CC_MVPMatrix * a_position;
	v_fragmentColor = a_color;
	v_texCoord = a_texCoord;
}
`

var VERT_SHADER_NMPV = `

attribute vec4 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;
#ifdef GL_ES
varying lowp vec4 v_fragmentColor;
varying mediump vec2 v_texCoord;
#else
varying vec4 v_fragmentColor;
varying vec2 v_texCoord;
#endif
void main()
{
	gl_Position = CC_PMatrix * a_position;
	v_fragmentColor = a_color;
	v_texCoord = a_texCoord;
}

`

var FRAG_SHADER = `

#ifdef GL_ES
precision lowp float;
#endif

varying vec4 v_fragmentColor;
varying vec2 v_texCoord;

void main()
{
	vec4 tex0 = texture2D(CC_Texture0, v_texCoord);
	vec4 tex1 = texture2D(CC_TexAlpha, v_texCoord);
	gl_FragColor =  v_fragmentColor * vec4( tex0.rgb , tex0.a * tex1.a );
}
`

var FRAG_SHADER_BG = `

#ifdef GL_ES
precision lowp float;
#endif

varying vec4 v_fragmentColor;
varying vec2 v_texCoord;

void main()
{
	vec4 tex0 = texture2D(CC_Texture0, v_texCoord);
	gl_FragColor =  v_fragmentColor * vec4( tex0.rgb , tex0.a );
}
`
if( !cc.GLProgramCache )
{
	cc.GLProgramCache = {
		getInstance : function()
		{
			return {
				addGLProgramFromByteArray : function (  ) {
					console.log( arguments )
				} ,
				addGLProgramFromFile : function(  ) {				
					console.log( arguments )
				}
			}
		}	
	}
}


function get_effect( source, atlas )
{
	source = 'effect/' + source

	if( source.endsWith(".particle") )
	{
		let model = y2d.ParticleEffect2D.create( source )
		model.setName( source )
		return model
	}

	if( source.endsWith(".cfx") )
    {
		let model = y2d.CompositiveEffect2D.create( source )
		if( !model )
		{
			console.error( 'cant found file ', source )
			return
		}

		//model.setScaleFactor( BASE_SCALE or 1 )
		model.setName( source )
		return model
	}

	if( atlas )
	{
		atlas = 'effect/' + atlas
	}
	else
	{
		atlas = source
	}
	let model = sp.SkeletonAnimation.create( source + '.scsp' , atlas + '.atlas' , 1 )
	model.setName( source )

	if( cc.GLProgramState )
	{
		if ( !_get_cocos_refid( MODEL_GL_PROGRAM ) ){
			MODEL_GL_PROGRAM = cc.GLProgramCache.getInstance().addGLProgramFromByteArray( "@pre_model" , VERT_SHADER_NMPV, FRAG_SHADER )
		}
		if( !_get_cocos_refid( MODEL_GL_PROGRAM_STATE ) ) {
			MODEL_GL_PROGRAM_STATE = cc.GLProgramState.create( MODEL_GL_PROGRAM )
		}
		model.setDefaultGLProgramState( MODEL_GL_PROGRAM_STATE )
		model.setGLProgramState( MODEL_GL_PROGRAM_STATE )	
	}
	return model
}

exports.get_effect = get_effect


function get_effect_bg( source, atlas )
{
	source = 'effect/' + source
	
	if( source.endsWith(".particle") )
	{
		let model = y2d.ParticleEffect2D.create( source )
		model.setName( source )
		return model
	}

	if( source.endsWith(".cfx") )
	{
		let model = y2d.CompositiveEffect2D.create( source )
		if( !model )
		{
			console.error( 'cant found file ', source )
			return
		}
		//model.setScaleFactor( BASE_SCALE or 1 )
		//model.setName( effect_id )
		return model
	}

	if( atlas )
	{
		atlas = 'effect/' + atlas
	}
	else
	{
		atlas = source
	}
	let model = sp.SkeletonAnimation.create( source + '.scsp' , atlas + '.atlas' , 1 )
	model.setName( source )

	if( cc.GLProgramState )
	{
		if ( !_get_cocos_refid( MODEL_GL_PROGRAM_BG ) ){
			MODEL_GL_PROGRAM_BG = cc.GLProgramCache.getInstance().addGLProgramFromByteArray( "@pre_model_bg" , VERT_SHADER_NMPV, FRAG_SHADER_BG )
		}
		if( !_get_cocos_refid( MODEL_GL_PROGRAM_STATE_BG ) ) {
			MODEL_GL_PROGRAM_STATE_BG = cc.GLProgramState.create( MODEL_GL_PROGRAM_BG )
		}
		model.setDefaultGLProgramState( MODEL_GL_PROGRAM_STATE_BG )
		model.setGLProgramState( MODEL_GL_PROGRAM_STATE_BG )	
	}
	return model
}

exports.get_effect_bg = get_effect_bg


function addTouchEndEventListener(node, func) {
	if (!node || !_get_cocos_refid(node)) return

	node._touch_end_func = function(_node = node, sender, state, x, y) {
		if (!_node?.isVisible()) return;
		console.log(`touch event : ${_node.getName()} : ${_node.getParent().getName()}`);
		func(_node, sender, state, x, y);
	};

	function touchEndHandler(sender, state, x, y) {
		if (state == 2) {
			node._touch_end_func?.(node, sender, state, x, y);
		}
	}

	node.addTouchEventListener(touchEndHandler);
}

exports.addTouchEndEventListener = addTouchEndEventListener

