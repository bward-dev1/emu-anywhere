"use strict";
function GameBoyAdvanceJoyPad(IOCore) {
    this.IOCore = IOCore;
}
GameBoyAdvanceJoyPad.prototype.initialize = function () {
    this.keyInput = 0x3FF;
    this.keyInterrupt = 0;
}
GameBoyAdvanceJoyPad.prototype.keyPress = function (keyPressed) {
    keyPressed = keyPressed | 0;
    keyPressed = 1 << (keyPressed | 0);
    this.keyInput = this.keyInput & (~keyPressed);
    this.checkForMatch();
}
GameBoyAdvanceJoyPad.prototype.keyRelease = function (keyReleased) {
    keyReleased = keyReleased | 0;
    keyReleased = 1 << (keyReleased | 0);
    this.keyInput = this.keyInput | keyReleased;
    this.checkForMatch();
}
GameBoyAdvanceJoyPad.prototype.checkForMatch = function () {
    if ((this.keyInterrupt & 0x8000) != 0) {
        if (((~this.keyInput) & this.keyInterrupt & 0x3FF) == (this.keyInterrupt & 0x3FF)) {
            this.IOCore.deflagStop();
            this.checkForIRQ();
        }
    }
    else if (((~this.keyInput) & this.keyInterrupt & 0x3FF) != 0) {
        this.IOCore.deflagStop();
        this.checkForIRQ();
    }
}
GameBoyAdvanceJoyPad.prototype.checkForIRQ = function () {
    if ((this.keyInterrupt & 0x4000) != 0) {
        this.IOCore.irq.requestIRQ(0x1000);
    }
}
GameBoyAdvanceJoyPad.prototype.readKeyStatus8_0 = function () {
    return this.keyInput & 0xFF;
}
GameBoyAdvanceJoyPad.prototype.readKeyStatus8_1 = function () {
    return (this.keyInput >> 8) | 0;
}
GameBoyAdvanceJoyPad.prototype.readKeyStatus16 = function () {
    return this.keyInput | 0;
}
GameBoyAdvanceJoyPad.prototype.writeKeyControl8_0 = function (data) {
    data = data | 0;
    this.keyInterrupt = this.keyInterrupt & 0xC300;
    data = data & 0xFF;
    this.keyInterrupt = this.keyInterrupt | data;
}
GameBoyAdvanceJoyPad.prototype.writeKeyControl8_1 = function (data) {
    data = data | 0;
    this.keyInterrupt = this.keyInterrupt & 0xFF;
    data = data & 0xC3;
    this.keyInterrupt = this.keyInterrupt | (data << 8);
}
GameBoyAdvanceJoyPad.prototype.writeKeyControl16 = function (data) {
    data = data | 0;
    this.keyInterrupt = data & 0xC3FF;
}
GameBoyAdvanceJoyPad.prototype.readKeyControl8_0 = function () {
    return this.keyInterrupt & 0xFF;
}
GameBoyAdvanceJoyPad.prototype.readKeyControl8_1 = function () {
    return (this.keyInterrupt >> 8) | 0;
}
GameBoyAdvanceJoyPad.prototype.readKeyControl16 = function () {
    return this.keyInterrupt | 0;
}
GameBoyAdvanceJoyPad.prototype.readKeyStatusControl32 = function () {
    return this.keyInput | (this.keyInterrupt << 16);
}