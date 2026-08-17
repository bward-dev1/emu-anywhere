"use strict";
function GameBoyAdvanceOBJWindowRenderer(compositor) {
    //Get a layer compositor that we'll send our parameters for windowing to:
    this.compositor = compositor;
}
GameBoyAdvanceOBJWindowRenderer.prototype.initialize = function () {
    //Initialize the compositor:
    this.compositor.initialize();
    //Layer masking & color effects control:
    this.WINOBJOutside = 0;
    //Need to update the color effects status in the compositor:
    this.preprocess();
}
GameBoyAdvanceOBJWindowRenderer.prototype.renderScanLine = function (line, toRender) {
    line = line | 0;
    toRender = toRender | 0;
    //Windowing can disable out further layers:
    toRender = toRender & this.WINOBJOutside;
    //Windowing occurs where there is a non-transparent "obj-win" sprite:
    this.compositor.renderScanLine(toRender | 0);
}
GameBoyAdvanceOBJWindowRenderer.prototype.writeWINOBJIN8 = function (data) {
    data = data | 0;
    //Layer masking & color effects control:
    this.WINOBJOutside = data | 0;
    //Need to update the color effects status in the compositor:
    this.preprocess();
}
GameBoyAdvanceOBJWindowRenderer.prototype.preprocess = function () {
    //Update the color effects status in the compositor:
    this.compositor.preprocess(this.WINOBJOutside & 0x20);
}