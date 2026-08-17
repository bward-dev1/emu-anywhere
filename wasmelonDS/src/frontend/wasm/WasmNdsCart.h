#ifndef WASMNDSCART_H
#define WASMNDSCART_H

#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <memory>

#include "Platform.h"
#include "NDSCart.h"

namespace wasmelon {
  class WasmNdsCart {
  private:
    std::unique_ptr<melonDS::NDSCart::CartCommon> cart;

  public:
    WasmNdsCart();

    bool loadFromFile(std::string filename);

    std::string getCartTitle();
    std::string getCartCode();
    std::unique_ptr<melonDS::NDSCart::CartCommon> getCart();

    static std::string getCommonCartTitle(melonDS::NDSCart::CartCommon *cart);
    static std::string getCommonCartCode(melonDS::NDSCart::CartCommon *cart);
  };
}


#endif