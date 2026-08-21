#!/usr/bin/env bash
# Force the system libpthread to be used by preloading it. This is a fallback when
# the process is still ending up loading /snap/core20 libpthread.

# Get script directory and cd to it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Unset any snap-related library paths
unset LD_LIBRARY_PATH

# Start vite dev server in background
echo "Starting Vite dev server..."
pnpm dev &
VITE_PID=$!

# Wait for vite to be ready
sleep 3

# Build the Rust/Tauri app
echo "Building Tauri app..."
cd src-tauri
cargo build

# Run with forced system pthread
echo "Running Tauri app with system pthread..."
LD_PRELOAD=/lib/x86_64-linux-gnu/libpthread.so.0 ./target/debug/desktop

# Cleanup: kill vite when tauri exits
kill $VITE_PID 2>/dev/null
