#!/bin/bash
# scripts/dev.sh — Levantar Transcribro en modo desarrollo (Electron)

set -e

cd "$(dirname "$0")/.."

echo "Rebuilding native modules..."
npm run rebuild

echo "Starting Electron dev server..."
npm run dev
