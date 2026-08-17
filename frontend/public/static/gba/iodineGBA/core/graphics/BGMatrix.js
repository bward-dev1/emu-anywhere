"use strict";
function GameBoyAdvanceBGMatrixRenderer(gfx) {
    this.gfx = gfx;
}
GameBoyAdvanceBGMatrixRenderer.prototype.initialize = function () {
    this.VRAM = this.gfx.VRAM;
    this.palette = this.gfx.palette256;
    this.screenSizePreprocess(0);
    this.screenBaseBlockPreprocess(0);
    this.characterBaseBlockPreprocess(0);
    this.displayOverflowProcess(0);
}
if (typeof Math.imul == "function") {
    //Math.imul found, insert the optimized path in:
    GameBoyAdvanceBGMatrixRenderer.prototype.fetchTile = function (x, y) {
        //Compute address for tile VRAM to address:
        x = x | 0;
        y = y | 0;
        var tileNumber = ((x | 0) + Math.imul(y | 0, this.mapSize | 0)) | 0;
        return this.VRAM[((tileNumber | 0) + (this.BGScreenBaseBlock | 0)) & 0xFFFF] | 0;
    }
}
else {
    //Math.imul not found, use the compatibility method:
    GameBoyAdvanceBGMatrixRenderer.prototype.fetchTile = function (x, y) {
        //Compute address for tile VRAM to address:
        var tileNumber = x + (y * this.mapSize);
        return this.VRAM[(tileNumber + this.BGScreenBaseBlock) & 0xFFFF];
    }
}
GameBoyAdvanceBGMatrixRenderer.prototype.computeScreenAddress = function (x, y) {
    //Compute address for character VRAM to address:
    x = x | 0;
    y = y | 0;
    var address = this.fetchTile(x >> 3, y >> 3) << 6;
    address = ((address | 0) + (this.BGCharacterBaseBlock | 0)) | 0;
    address = ((address | 0) + ((y & 0x7) << 3)) | 0;
    address = ((address | 0) + (x & 0x7)) | 0;
    return address | 0;
}
GameBoyAdvanceBGMatrixRenderer.prototype.fetchPixelOverflow = function (x, y) {
    //Fetch the pixel:
    x = x | 0;
    y = y | 0;
    //Output pixel:
    var address = this.computeScreenAddress(x & this.mapSizeComparer, y & this.mapSizeComparer) | 0;
    return this.palette[this.VRAM[address & 0xFFFF] & 0xFF] | 0;
}
GameBoyAdvanceBGMatrixRenderer.prototype.fetchPixelNoOverflow = function (x, y) {
    //Fetch the pixel:
    x = x | 0;
    y = y | 0;
    //Output pixel:
    if ((x | 0) != (x & this.mapSizeComparer) || (y | 0) != (y & this.mapSizeComparer)) {
        //Overflow Handling:
        //Out of bounds with no overflow allowed:
        return 0x3800000;
    }
    var address = this.computeScreenAddress(x | 0, y | 0) | 0;
    return this.palette[this.VRAM[address & 0xFFFF] & 0xFF] | 0;
}
GameBoyAdvanceBGMatrixRenderer.prototype.screenBaseBlockPreprocess = function (BGScreenBaseBlock) {
    BGScreenBaseBlock = BGScreenBaseBlock | 0;
    this.BGScreenBaseBlock = BGScreenBaseBlock << 11;
}
GameBoyAdvanceBGMatrixRenderer.prototype.characterBaseBlockPreprocess = function (BGCharacterBaseBlock) {
    BGCharacterBaseBlock = BGCharacterBaseBlock | 0;
    this.BGCharacterBaseBlock = BGCharacterBaseBlock << 14;
}
GameBoyAdvanceBGMatrixRenderer.prototype.screenSizePreprocess = function (BGScreenSize) {
    BGScreenSize = BGScreenSize | 0;
    this.mapSize = 0x10 << (BGScreenSize | 0);
    this.mapSizeComparer = ((this.mapSize << 3) - 1) | 0;
}
GameBoyAdvanceBGMatrixRenderer.prototype.displayOverflowPreprocess = function (doOverflow) {
    doOverflow = doOverflow | 0;
    if ((doOverflow | 0) != (this.BGDisplayOverflow | 0)) {
        this.displayOverflowProcess(doOverflow | 0);
    }
}
GameBoyAdvanceBGMatrixRenderer.prototype.displayOverflowProcess = function (doOverflow) {
    doOverflow = doOverflow | 0;
    this.BGDisplayOverflow = doOverflow | 0;
    if ((doOverflow | 0) != 0) {
        this.fetchPixel = this.fetchPixelOverflow;
    }
    else {
        this.fetchPixel = this.fetchPixelNoOverflow;
    }
}