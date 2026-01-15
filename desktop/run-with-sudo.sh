#!/usr/bin/env bash
# Run the Tauri app with sudo privileges for disk wiping

# Get script directory and cd to it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Preserve user environment while running with sudo
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# Kill any existing instances
pkill -f "desktop" 2>/dev/null || true
sleep 1
lsof -ti:1420 | xargs kill -9 2>/dev/null || true

# Start vite dev server as regular user in background
echo "Starting Vite dev server..."
pnpm dev &
VITE_PID=$!

# Wait for vite to be ready (check if port 1420 is listening)
echo "Waiting for Vite dev server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:1420 > /dev/null 2>&1; then
        echo "Vite dev server is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Timeout waiting for Vite dev server"
        kill $VITE_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

# Build and run Tauri with sudo
echo "Building Tauri app..."
cd src-tauri
cargo build 2>&1 | grep -E "(Compiling|Finished|error|warning:.*error)" || true

if [ $? -eq 0 ]; then
    echo "Running Tauri app with sudo..."
    # Run the binary with sudo, preserving display environment
    # Clear LD_LIBRARY_PATH and LD_PRELOAD to prevent snap library conflicts
    # Also unset any snap-related environment variables that might interfere
    sudo env \
        DISPLAY="$DISPLAY" \
        XAUTHORITY="$XAUTHORITY" \
        XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
        HOME="$HOME" \
        LD_LIBRARY_PATH="" \
        LD_PRELOAD="" \
        ./target/debug/desktop
else
    echo "Build failed!"
    kill $VITE_PID 2>/dev/null
    exit 1
fi
