"use strict";
function GameBoyAdvanceSRAMChip() {
    this.saves = null;
    this.TILTChip = null;
    this.TILTChipUnlocked = 0;
}
GameBoyAdvanceSRAMChip.prototype.initialize = function () {
    if (this.saves == null || (this.saves.length | 0) != 0x8000) {
        this.saves = getUint8Array(0x8000);
    }
}
GameBoyAdvanceSRAMChip.prototype.load = function (save) {
    if ((save.length | 0) == 0x8000) {
        this.saves = save;
    }
}
GameBoyAdvanceSRAMChip.prototype.read = function (address) {
    address = address | 0;
    var data = 0;
    if ((address | 0) < 0x8000 || (this.TILTChipUnlocked | 0) != 3) {
        data = this.saves[address & 0x7FFF] | 0;
    }
    else {
        switch (address | 0) {
            case 0x8200:
                data = this.TILTChip.readXLow() | 0;
                break;
            case 0x8300:
                data = this.TILTChip.readXHigh() | 0;
                break;
            case 0x8400:
                data = this.TILTChip.readYLow() | 0;
                break;
            case 0x8500:
                data = this.TILTChip.readYHigh() | 0;
                break;
            default:
                data = this.saves[address & 0x7FFF] | 0;
        }
    }
    return data | 0;
}
GameBoyAdvanceSRAMChip.prototype.write = function (address, data) {
    address = address | 0;
    data = data | 0;
    if ((address | 0) < 0x8000 || (this.TILTChipUnlocked | 0) >= 4) {
        //Normal SRAM write:
        this.saves[address & 0x7FFF] = data | 0;
    }
    else {
        switch (address | 0) {
            case 0x8000:
                if ((data | 0) == 0x55) {           //Magic Combo.
                    this.TILTChipUnlocked |= 0x1;   //Tilt unlock stage 1.
                }
                else {
                    this.TILTChipUnlocked |= 0x4;   //Definitely not using a tilt sensor.
                }
                break;
            case 0x8100:
                if ((data | 0) == 0xAA) {           //Magic Combo.
                    this.TILTChipUnlocked |= 0x2;   //Tilt unlock stage 2.
                }
                else {
                    this.TILTChipUnlocked |= 0x4;   //Definitely not using a tilt sensor.
                }
                break;
            default:
                //Check for mirroring while not tilt chip:
                if ((this.TILTChipUnlocked | 0) == 0) {
                    this.saves[address & 0x7FFF] = data | 0;
                    this.TILTChipUnlocked |= 0x4;   //Definitely not using a tilt sensor.
                }
        }
    }
}