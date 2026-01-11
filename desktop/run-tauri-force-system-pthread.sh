#!/usr/bin/env bash
# Force the system libpthread to be used by preloading it. This is a fallback when
# the process is still ending up loading /snap/core20 libpthread.

unset LD_LIBRARY_PATH
# set LD_PRELOAD to the system libpthread path
export LD_PRELOAD=/lib/x86_64-linux-gnu/libpthread.so.0

exec pnpm tauri dev "$@"
