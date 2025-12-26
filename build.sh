#!/bin/bash
# Build script for Railway deployment
# This builds the frontend and copies it to backend/static

set -e

echo "Building frontend..."
cd frontend
npm install
npm run build

echo "Copying frontend build to backend/static..."
rm -rf ../backend/static
cp -r dist ../backend/static

echo "Build complete!"
