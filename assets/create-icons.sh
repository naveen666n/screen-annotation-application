#!/bin/bash

# Create a simple placeholder icon
# This creates a basic 1024x1024 PNG with a brush icon placeholder

cd "$(dirname "$0")"

# Create SVG icon
cat > icon.svg << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4287f5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="512" cy="512" r="480" fill="url(#grad)"/>
  <!-- Brush icon -->
  <path d="M 512 256 L 768 512 L 688 592 L 432 336 L 512 256 Z" fill="white" opacity="0.9"/>
  <path d="M 400 368 L 656 624 L 368 912 L 256 800 L 400 368 Z" fill="white" opacity="0.7"/>
  <circle cx="512" cy="256" r="48" fill="white" opacity="0.9"/>
</svg>
EOF

# Convert SVG to PNG using built-in tools (if available)
if command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 1024 -h 1024 icon.svg -o icon.png
elif command -v convert &> /dev/null; then
    convert -background none icon.svg -resize 1024x1024 icon.png
else
    echo "Note: SVG to PNG conversion requires rsvg-convert or ImageMagick"
    echo "The SVG file has been created. You can manually convert it or install imagemagick:"
    echo "  brew install librsvg"
    echo "  or"
    echo "  brew install imagemagick"
fi

# Create icns file for macOS (if PNG exists)
if [ -f icon.png ]; then
    # Create iconset directory
    mkdir -p icon.iconset

    # Generate different sizes using sips (macOS built-in)
    sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
    sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
    sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
    sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
    sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
    sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
    sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
    sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
    sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
    cp icon.png icon.iconset/icon_512x512@2x.png

    # Create icns file
    iconutil -c icns icon.iconset

    # Clean up
    rm -rf icon.iconset

    echo "✓ macOS icon.icns created"

    # For Windows, just copy the PNG as .ico (electron-builder will handle conversion)
    cp icon.png icon.ico
    echo "✓ Windows icon.ico created"
else
    echo "icon.png not found. Please convert icon.svg to icon.png first."
fi

echo ""
echo "Icon files created in assets/ directory"
echo "  - icon.svg (source)"
echo "  - icon.png (1024x1024)"
echo "  - icon.icns (macOS)"
echo "  - icon.ico (Windows)"
