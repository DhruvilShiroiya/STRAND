#!/bin/bash

# Get the directory where this script is located
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "-----------------------------------"
echo "  STRAND AUTO-START (EXAMPLE)"
echo "-----------------------------------"

# Kill any existing processes to avoid port conflicts
echo "Checking for existing processes..."
pkill -f "node server/index.js" || true
pkill -f "cloudflared tunnel run your-tunnel-name" || true

# Start Server
echo "Starting Node.js server..."
npm start >> server.log 2>&1 &

# Start Tunnel
# REPLACE 'your-tunnel-name' with your actual Cloudflare tunnel name
echo "Starting Cloudflare Tunnel..."
cloudflared tunnel run your-tunnel-name >> tunnel.log 2>&1 &

echo "-----------------------------------"
echo "Strand services are starting up."
echo "Logs available in server.log and tunnel.log"
echo "-----------------------------------"

sleep 2
