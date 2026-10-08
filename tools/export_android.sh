#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-$PWD/build/android-user}"
mkdir -p "$ANDROID_USER_HOME"
godot --headless --editor --import --path . --quit
godot --headless --path . --export-debug Android build/shadow-zoo.apk
printf 'Built %s/build/shadow-zoo.apk\n' "$PWD"
