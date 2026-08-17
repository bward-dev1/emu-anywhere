"use strict";
function GameBoyAdvanceGPIOChip() {
    this.type = 0;
    this.data = 0;
    this.direction = 0;
    this.readWrite = 0;
}
GameBoyAdvanceGPIOChip.prototype.getType = function () {
    return this.type | 0;
}
GameBoyAdvanceGPIOChip.prototype.setType = function (type) {
    type = type | 0;
    this.type = type | 0;
}
GameBoyAdvanceGPIOChip.prototype.read = function (address) {
    address = address | 0;
    var data = 0;
    if (this.readWrite | 0) {
        switch (address & 0xF) {
            case 0x4:
                this.readTick();
                data = this.data | 0;
                break;
            case 0x6:
                data = this.direction | 0;
                break;
            case 0x8:
                data = this.readWrite | 0;
        }
    }
    return data | 0;
}
GameBoyAdvanceGPIOChip.prototype.write = function (address, data) {
    address = address | 0;
    data = data | 0;
    switch (address & 0xF) {
        case 0x4:
            this.data = data & 0xF;
            this.writeTick(data | 0);
            break;
        case 0x6:
            this.direction = data & 0xF;
            break;
        case 0x8:
            this.readWrite = data & 0x1;
    }
}
