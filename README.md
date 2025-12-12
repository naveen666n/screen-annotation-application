# Screen Annotation App

A powerful Electron-based screen annotation and whiteboard application for content creators, educators, and presenters. Features transparent overlay annotations, draggable objects, and comprehensive drawing tools.

[DOWNLOAD APPLICATION](https://mega.nz/folder/0V8mWITK#yvXE5D9qfMQuKopU54UIdw)


## Features

### Core Drawing Tools
- **Brush Tool**: Freehand drawing with adjustable size and color
- **Eraser**: Remove unwanted annotations
- **Text Tool**: Add text annotations with customizable font sizes (16px - 64px)
- **Select & Move**: Select and drag drawn objects anywhere on screen
- **Shapes**: Arrow, Rectangle, Circle, Line, Rounded Rectangle, Star

### Interactive Features
- **Mouse Highlighter**: Spotlight effect with adjustable size (controlled by size slider)
- **Laser Pointer**: Animated pointer with trailing effect (uses selected color)
- **Magnifier**: Zoom tool with 2x magnification
- **Keyboard Display**: Show live keyboard shortcuts on screen for tutorials

### Customization
- **Color Picker**: Full RGB color selection for all drawing tools
- **Size Control**: Adjustable brush/shape size (2-20px) and highlighter size (20-200px)
- **Background Options**: Transparent, White, Light Gray, Dark, Light Blue, Cream
- **Grid Overlays**: Dotted grid, Line grid, or No grid

### Advanced Functionality
- **Draggable Objects**: Move any drawn shape or brush stroke using Select tool
- **Undo/Redo**: Full history management with Ctrl+Z/Ctrl+Y support
- **Pass-Through Mode**: Click through overlay to interact with applications behind
- **Always On Top**: Stays visible over fullscreen applications
- **Screenshot Capture**: Save annotated screens as PNG images
- **Whiteboard Mode**: Open separate resizable whiteboard window

## Project Structure

```
screen-annotation-app/
├── src/
│   ├── main/
│   │   └── index.ts           # Main Electron process
│   ├── preload/
│   │   └── index.ts           # IPC bridge (context isolation)
│   └── renderer/
│       ├── index.html         # Overlay window UI
│       ├── app.ts             # Main application logic
│       ├── styles.css         # Overlay styles
│       ├── whiteboard.html    # Whiteboard window UI
│       ├── whiteboard-app.ts  # Whiteboard logic
│       └── whiteboard-styles.css
├── dist/                      # Compiled JavaScript output
├── release/                   # Built application packages
├── package.json
└── tsconfig.json
```

## Technology Stack

- **Electron**: v27.1.3 - Desktop application framework
- **TypeScript**: v5.3.3 - Type-safe JavaScript
- **Node.js**: Built-in process management
- **HTML5 Canvas**: High-performance 2D drawing

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)

### Setup
```bash
# Clone repository
git clone <repository-url>
cd screen-annotation-app

# Install dependencies
npm install
```

## Build Process

### Development Build
```bash
# Build TypeScript and copy files
npm run build

# Components:
# 1. Clean: Remove dist and release directories
# 2. Build TypeScript: Compile .ts files to .js
# 3. Copy Files: Copy HTML and CSS to dist/
```

### Development Mode
```bash
# Start with auto-rebuild
npm start

# This runs: npm run build && electron .
# Opens DevTools automatically in development
```

### Production Build
```bash
# Build application package
npm run make

# Creates platform-specific installer in release/
# Formats: .dmg (macOS), .exe (Windows), .deb/.rpm (Linux)
```

### Build Scripts
- `npm run clean` - Remove build artifacts
- `npm run build:ts` - Compile TypeScript only
- `npm run copy:files` - Copy static assets only
- `npm run build` - Full build (clean + compile + copy)
- `npm start` - Development server
- `npm run make` - Production package

## Usage

### Basic Workflow
1. Launch application - Transparent overlay appears
2. Select tool from floating toolbar
3. Draw/annotate on screen
4. Use Select tool to move objects
5. Save screenshot or clear canvas

### Keyboard Shortcuts
- **Ctrl+Z**: Undo last action
- **Ctrl+Y**: Redo action
- **ESC**: Cancel current operation

### Tool Tips
- **Dragging Objects**: Use Select tool (first button), click any drawn item and drag
- **Highlighter Size**: Adjust with size slider (range: 20-200px)
- **Laser Pointer Color**: Changes with color picker selection
- **Pass-Through**: Enable to click through overlay to apps behind
- **Fullscreen Compatible**: Works over fullscreen presentations and videos

## Configuration

### Window Settings (src/main/index.ts)
```typescript
{
  transparent: true,        // Transparent background
  frame: false,             // No window frame
  alwaysOnTop: true,        // Stay above all windows
  fullscreenable: false,    // Prevent fullscreen toggle
  enableLargerThanScreen: true
}
```

### Canvas Settings (src/renderer/app.ts)
```typescript
// Default values
color: '#ff0000'          // Red
size: 5                   // 5px brush
fontSize: 24              // 24px text
highlighterSizeMultiplier: 10  // Size × 10
```

## Architecture

### Main Process (src/main/index.ts)
- Window management and lifecycle
- IPC handlers for screenshots and whiteboard
- Click-through mode management
- Always-on-top configuration

### Renderer Process (src/renderer/app.ts)
- Canvas drawing and object management
- Tool selection and event handling
- Object-based architecture for draggable items
- History management (undo/redo)

### Preload Script (src/preload/index.ts)
- Secure IPC communication bridge
- Exposes limited API to renderer:
  - toggleClickThrough
  - setMouseOverToolbar
  - saveScreenshot
  - openWhiteboard

## Object-Based Drawing System

Drawn items are stored as objects with:
- **Type**: brush, shape, or text
- **Properties**: color, size, tool type
- **Geometry**: points array or start/end coordinates
- **Bounds**: Bounding box for hit detection

This enables:
- Drag and reposition any drawn element
- Precise hit testing with 10px padding
- Real-time redrawing during drag operations
- Object persistence across operations

## Platform Compatibility

- **macOS**: Full support, hides dock icon
- **Windows**: Full support
- **Linux**: Full support (X11 and Wayland)

## Known Limitations

- Eraser removes canvas pixels (not object-based yet)
- Text objects not draggable (planned feature)
- Whiteboard window doesn't sync with overlay

## Version

**Current Version**: 2.5.0

## License

Copyright (c) 2024. All rights reserved.
