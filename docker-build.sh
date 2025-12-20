#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Eros Docker Build Script${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Parse arguments
FORCE_REBUILD=0
SKIP_CACHE=0

for arg in "$@"; do
  case $arg in
    --no-cache)
      SKIP_CACHE=1
      echo -e "${YELLOW}⚠️  No cache mode enabled${NC}"
      ;;
    --force)
      FORCE_REBUILD=1
      echo -e "${YELLOW}⚠️  Force rebuild enabled${NC}"
      ;;
    --help|-h)
      echo "Usage: ./docker-build.sh [options]"
      echo ""
      echo "Options:"
      echo "  --no-cache    Build without using cache (slow, full rebuild)"
      echo "  --force       Remove existing image before build"
      echo "  --help, -h    Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./docker-build.sh              # Normal build with cache"
      echo "  ./docker-build.sh --force      # Remove old image and rebuild"
      echo "  ./docker-build.sh --no-cache   # Full rebuild without cache"
      exit 0
      ;;
  esac
done

# Remove existing image if force rebuild
if [ $FORCE_REBUILD -eq 1 ]; then
  echo -e "${YELLOW}🗑️  Removing existing eros image...${NC}"
  docker rmi eros:latest 2>/dev/null || true
fi

# Build command
BUILD_CMD="docker compose build"

if [ $SKIP_CACHE -eq 1 ]; then
  BUILD_CMD="$BUILD_CMD --no-cache"
fi

echo -e "${GREEN}🔨 Building Docker image...${NC}"
echo -e "${BLUE}Command: $BUILD_CMD${NC}"
echo ""

# Execute build
$BUILD_CMD

# Check if build was successful
if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Build completed successfully!${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo "  • Start containers: ${GREEN}docker compose up -d${NC}"
  echo "  • View logs:        ${GREEN}docker compose logs -f app${NC}"
  echo "  • Stop containers:  ${GREEN}docker compose down${NC}"
  echo ""
else
  echo ""
  echo -e "${RED}❌ Build failed!${NC}"
  exit 1
fi
