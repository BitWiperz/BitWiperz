#!/usr/bin/env bash
# Run Tauri dev with a completely clean environment to avoid snap library conflicts

cd "$(dirname "$0")"

# Start vite dev server in background
echo "Starting Vite dev server..."
/home/nits/.nvm/versions/node/v20.19.6/bin/pnpm dev &
VITE_PID=$!

# Wait for vite to be ready
echo "Waiting for Vite dev server to be ready..."
until curl -s http://localhost:1420 > /dev/null 2>&1; do
    sleep 1
done
echo "Vite dev server is ready!"

# Build and run the Rust/Tauri app with clean environment
echo "Building and running Tauri app..."
cd src-tauri

# Build
cargo build

# Run with sudo
echo "Running Tauri app with sudo..."
sudo -E ./target/debug/desktop

# Cleanup: kill vite when tauri exits
kill $VITE_PID 2>/dev/null
