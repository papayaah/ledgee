#!/bin/bash

# Shaw AI Deployment Script
# Builds and prepares the app for static hosting

set -e

echo "🚀 Shaw AI Deployment Helper"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the Shaw AI project directory?"
    exit 1
fi

# Check if Shaw AI project
if ! grep -q "shawai" package.json; then
    print_error "This doesn't appear to be the Shaw AI project"
    exit 1
fi

print_status "Checking dependencies..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js version is $NODE_VERSION. Recommended: 18+"
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not available"
    exit 1
fi

print_status "Installing/updating dependencies..."
npm install

print_status "Cleaning previous builds..."
rm -rf .next out

print_status "Checking required files..."

# Check if sql-wasm.wasm exists
if [ ! -f "public/sql-wasm.wasm" ]; then
    print_warning "sql-wasm.wasm not found in public folder"
    print_status "Copying from node_modules..."
    if [ -f "node_modules/sql.js/dist/sql-wasm.wasm" ]; then
        cp node_modules/sql.js/dist/sql-wasm.wasm public/
        print_success "Copied sql-wasm.wasm"
    else
        print_error "Could not find sql-wasm.wasm in node_modules"
        exit 1
    fi
else
    print_success "sql-wasm.wasm found"
fi

# Check favicon
if [ ! -f "public/favicon.svg" ]; then
    print_warning "favicon.svg not found"
else
    print_success "favicon.svg found"
fi

print_status "Running TypeScript checks..."
npm run type-check

print_status "Building static site..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    print_error "Build failed!"
    exit 1
fi

# Check if out directory was created
if [ ! -d "out" ]; then
    print_error "Output directory 'out' was not created"
    exit 1
fi

print_success "Build completed successfully!"

# Get build size
BUILD_SIZE=$(du -sh out | cut -f1)
print_status "Build size: $BUILD_SIZE"

# Count files
FILE_COUNT=$(find out -type f | wc -l)
print_status "Files generated: $FILE_COUNT"

echo ""
print_success "🎉 Shaw AI is ready for deployment!"
echo ""
print_status "Next steps:"
echo "  1. Upload the 'out' folder to your web host"
echo "  2. Or use one of these commands:"
echo ""
echo "  📦 Deploy to Vercel:"
echo "     vercel --prod"
echo ""
echo "  🌐 Deploy to Netlify:"
echo "     drag 'out' folder to netlify.com"
echo ""
echo "  🧪 Test locally:"
echo "     npx serve out -p 8080"
echo "     Then open http://localhost:8080"
echo ""
echo "  📁 Deploy anywhere:"
echo "     The 'out' folder contains everything needed!"
echo ""

# Deployment options menu
echo "Choose deployment option:"
echo "1) Test locally (serve on port 8080)"
echo "2) Deploy to Vercel (requires vercel CLI)"
echo "3) Just show me the files"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        print_status "Starting local server..."
        if command -v serve &> /dev/null; then
            serve out -p 8080
        else
            print_status "Installing serve..."
            npx serve out -p 8080
        fi
        ;;
    2)
        if command -v vercel &> /dev/null; then
            print_status "Deploying to Vercel..."
            vercel --prod
        else
            print_error "Vercel CLI not found. Install with: npm install -g vercel"
            print_status "Then run: vercel --prod"
        fi
        ;;
    3)
        print_status "Contents of 'out' directory:"
        ls -la out/
        ;;
    4)
        print_status "Deployment files ready in 'out' directory"
        ;;
    *)
        print_warning "Invalid choice. Files are ready in 'out' directory"
        ;;
esac

print_success "Done! 🚀"