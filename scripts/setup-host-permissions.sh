#!/bin/bash
# Host-side permission setup for Eros
# Run this ONCE on the host machine to fix media directory permissions
# This script should be run on the same machine where docker-compose runs

set -e

# Get the directory to fix from argument, or scan common locations
if [ -n "$1" ]; then
  TARGET_DIR="$1"
else
  echo "No directory specified. Scanning for common media paths..."
  echo ""
  echo "Usage: $0 /path/to/media/directory"
  echo ""
  echo "Or edit this script to add your custom paths."
  echo ""
  echo "Common paths to check:"
  echo "  /mnt/pve"
  echo "  /mnt/pve/DATA500"
  echo "  /data"
  echo ""
  exit 1
fi

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Setting up permissions for: $TARGET_DIR"
echo "Using UID: $PUID, GID: $PGID"
echo ""

# Check if directory exists
if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: Directory does not exist: $TARGET_DIR"
  echo "Create it first: mkdir -p $TARGET_DIR"
  exit 1
fi

# Create media subdirectories
echo "Creating media subdirectories..."
sudo mkdir -p "$TARGET_DIR/media/scenes" "$TARGET_DIR/media/incomplete"

# Fix ownership
echo "Fixing ownership..."
sudo chown -R ${PUID}:${PGID} "$TARGET_DIR"

# Fix permissions
echo "Fixing permissions..."
sudo chmod -R 775 "$TARGET_DIR"

# Set setgid bit on media directory (new files inherit group)
sudo chmod g+s "$TARGET_DIR/media" 2>/dev/null || true

echo ""
echo "✓ Permissions fixed for: $TARGET_DIR"
echo ""
echo "Verify with:"
echo "  ls -la $TARGET_DIR/media"
echo ""
echo "You can now restart the container:"
echo "  docker-compose up -d"
