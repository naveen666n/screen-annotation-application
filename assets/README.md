# Assets Directory

This directory contains application icons and resources.

## Required Icon Files

### macOS
- **icon.icns**: macOS application icon (1024x1024 base resolution)
  - Create using: `iconutil -c icns icon.iconset`
  - Contains multiple resolutions: 16x16, 32x32, 128x128, 256x256, 512x512, 1024x1024

### Windows
- **icon.ico**: Windows application icon
  - Multi-resolution .ico file
  - Recommended sizes: 16x16, 32x32, 48x48, 256x256

### Linux
- **icon.png**: Linux application icon
  - Single PNG file: 512x512 or 1024x1024

## Creating Icons

### From PNG using ImageMagick

#### macOS .icns
```bash
# Create iconset directory
mkdir icon.iconset

# Generate multiple sizes
sips -z 16 16     icon-1024.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon-1024.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon-1024.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_512x512.png
cp icon-1024.png icon.iconset/icon_512x512@2x.png

# Convert to icns
iconutil -c icns icon.iconset
```

#### Windows .ico
```bash
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

## Icon Design Guidelines

- **Simple and Clear**: Recognizable at small sizes
- **No Text**: Text becomes illegible at small sizes
- **Transparent Background**: PNG with alpha channel
- **Consistent Style**: Match application purpose
- **High Contrast**: Visible in both light and dark modes

## Placeholder Icons

For development, you can use placeholder icons:
1. Visit https://icon.kitchen or similar icon generator
2. Create icons with a brush/pen design
3. Export in all required formats
4. Place in this directory

## File Locations

After building, icons appear in:
- **macOS**: Inside .app bundle: `Contents/Resources/`
- **Windows**: Embedded in .exe
- **Linux**: Copied to application directory

---

**Note**: Without custom icons, electron-builder will use default Electron icons.
