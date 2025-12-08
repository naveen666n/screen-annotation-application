# Assets Directory

This directory contains the application icons and resources.

## Icon Files (Already Created!)

The app comes with a custom icon featuring a pen/brush and magnifier on a blue gradient background, representing the two core features of the app.

### ✅ Available Icons

- **icon-1024.png** - Source PNG (1024x1024) for reference
- **icon.icns** - macOS application icon (contains all required sizes)
- **icon.png** - Linux/Windows icon (512x512)
- **icon.iconset/** - macOS iconset with all sizes (16px to 1024px)

These icons are automatically used when building the application.

## Icon Design

The icon features:
- **Blue gradient background** - Modern, professional look
- **White pen/brush** - Represents the drawing/annotation feature
- **Magnifying glass** - Represents the zoom/magnifier feature
- **Clean, simple design** - Recognizable at all sizes (16px to 1024px)

## How Icons Are Used

When you build the application:
- **macOS**: `icon.icns` is embedded in the `.app` bundle at `Contents/Resources/`
- **Windows**: `icon.png` is converted and embedded in the `.exe`
- **Linux**: `icon.png` is included in AppImage and package files

The icons are referenced in `package.json` under the `build` configuration.
