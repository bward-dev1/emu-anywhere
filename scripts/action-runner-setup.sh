#!/bin/bash

# The purpose of this script is to install all necessary dependencies
# for the action runner to be able to build.

echo "Installing dependencies..."

# melonDS dependencies, from https://github.com/melonDS-emu/melonDS/blob/master/BUILD.md
sudo apt install cmake extra-cmake-modules libcurl4-gnutls-dev libpcap0.8-dev libsdl2-dev libarchive-dev libenet-dev libzstd-dev

echo "Installed!"
