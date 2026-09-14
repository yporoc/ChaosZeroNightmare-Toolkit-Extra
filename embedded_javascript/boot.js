
global._G = undefined

cc.Color = function (r, g, b, a) {
    this.r = r || 0;
    this.g = g || 0;
    this.b = b || 0;
    this.a = (a === undefined) ? 255 : a;
};


cc.Size = function(w,h)
{
    return {width:w, height:h};
};

cc.Vector2 = function(x,y)
{
    return {x:x, y:y};
};


{
  let prototype = cc.EventListenerKeyboard.prototype;
  Object.defineProperty(prototype, "onKeyPressed", {
  	set: function(f) { this.setOnKeyPressed(f); },
  });

  Object.defineProperty(prototype, "onKeyReleased", {
  	set: function(f) { this.setOnKeyReleased(f); },
  });
}


