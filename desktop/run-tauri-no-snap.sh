#!/usr/bin/env bash
# Wrapper to run `pnpm tauri dev` while unsetting LD_* variables that can cause
# snap-provided libraries (e.g. /snap/core20/*) to be loaded and cause symbol
# lookup errors.

unset LD_LIBRARY_PATH
unset LD_PRELOAD

# Forward all args to pnpm tauri dev
exec pnpm tauri dev "$@"
