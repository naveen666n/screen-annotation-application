# Screen Annotation App

A simple, clean screen annotation application for macOS with brush drawing and magnifier tools.

## Features

### 🎨 Screen Writer (Brush Tool)
- Draw freely on screen with smooth brush strokes
- Adjustable brush size (2-20px)
- Full color picker for any color
- Transparent overlay - see through while drawing

### 🔍 Magnifier Tool
- 2x magnification for detailed work
- Circular lens with crosshair for precision
- Real-time magnification as you move cursor
- Perfect for presentations and detailed annotations

### 🎯 Core Functions
- **Clear** - Remove all drawings instantly
- **Quit** - Properly closes application (no hanging processes)
- Simple toolbar with all essential controls

## Quick Start

### Installation
```bash
# Install dependencies (first time only)
npm install
```

### Run the App

**Development Mode** (with DevTools):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

### Build Installer
```bash
npm run dist:mac
```

Output: `release/ScreenAnnotation-1.0.0.dmg`

## Usage

### Drawing on Screen
1. **Launch** the app - Brush tool is active by default
2. **Pick a color** - Click the color picker in toolbar
3. **Adjust size** - Move the slider to change brush thickness
4. **Draw** - Click and drag on the canvas
5. **Clear** - Click "Clear" button to erase everything

### Using the Magnifier
1. **Click "Magnifier"** button in toolbar
2. **Move your mouse** around the screen
3. **View magnified area** in circular lens (2x zoom)
4. **See crosshair** for precise positioning
5. **Switch back** to Brush to continue drawing

### Quitting the App
- **Click "Quit"** button - App closes properly
- **Press Cmd+Q** - Standard macOS quit
- **No hanging processes** - Clean shutdown guaranteed

## Project Structure

```
screen-annotation-app/
├── src/
│   ├── main/
│   │   └── index.ts          # Main Electron process (app lifecycle)
│   ├── preload/
│   │   └── index.ts          # Security bridge between main and renderer
│   └── renderer/
│       ├── index.html        # UI structure and toolbar
│       ├── styles.css        # Clean, modern styling
│       └── app.ts            # Drawing and magnifier logic
├── dist/                     # Compiled JavaScript (auto-generated)
├── release/                  # Built installers (auto-generated)
├── package.json              # Dependencies and build scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Build Process

### Development Workflow

1. **Make changes** to TypeScript files in `src/`
2. **Build** with `npm run build` (compiles TS → JS in `dist/`)
3. **Run** with `npm run dev` (launches Electron)
4. **Test** the application
5. **Repeat** as needed

### Build Steps Explained

```bash
# Clean old builds and compile fresh
npm run build
```

This runs:
1. `npm run clean` - Removes `dist/` and `release/` folders
2. `npm run build:ts` - Compiles TypeScript to JavaScript
3. `npm run copy:files` - Copies HTML and CSS to `dist/`

### Production Build

```bash
# Create macOS installer
npm run dist:mac
```

Creates:
- `release/ScreenAnnotation-1.0.0.dmg` - Installer (~90MB)
- `release/ScreenAnnotation-1.0.0-mac.zip` - Portable version
- `release/mac/ScreenAnnotation.app` - Application bundle

## Technical Details

### Technology Stack
- **Framework**: Electron 27.1.3
- **Language**: TypeScript 5.3.3
- **Build**: electron-builder 24.9.1
- **Platform**: macOS (can be extended to Windows/Linux)

### Architecture

**Main Process** (`src/main/index.ts`):
- Manages application lifecycle
- Creates transparent overlay window
- Handles quit events properly
- No complex state management

**Renderer Process** (`src/renderer/app.ts`):
- Handles drawing on HTML5 canvas
- Manages brush and magnifier tools
- Updates UI based on user interactions
- Direct DOM manipulation for simplicity

**Preload Script** (`src/preload/index.ts`):
- Security bridge between main and renderer
- Minimal API exposure
- Context isolation enabled

### Key Design Decisions

**Why Simple?**
- ✅ Easier to maintain and debug
- ✅ Faster performance
- ✅ More reliable (less can break)
- ✅ Clean codebase (~10KB total)

**What Was Removed:**
- ❌ Global keyboard shortcuts (caused issues)
- ❌ Complex tool system with multiple classes
- ❌ Multi-layer canvas architecture
- ❌ Settings persistence (keep it simple)
- ❌ IPC complexity

**What Was Kept:**
- ✅ Core drawing functionality
- ✅ Magnifier for detailed work
- ✅ Essential controls
- ✅ Proper quit handling

## Configuration Files

### package.json
Defines:
- Project metadata (name, version, description)
- Build scripts (dev, build, dist:mac)
- Dependencies (electron, typescript, etc.)
- electron-builder configuration

### tsconfig.json
TypeScript compiler options:
- Target: ES2020
- Module: CommonJS
- Strict mode: Disabled for simplicity
- Output: `dist/` folder

### .gitignore
Ignores:
- `node_modules/` - Dependencies
- `dist/` - Built files
- `release/` - Installers
- `.DS_Store` - macOS files

## Development Guide

### Adding New Features

**Example: Add Undo Function**

1. **Track History** in `src/renderer/app.ts`:
```typescript
private history: ImageData[] = [];

private saveState() {
  const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  this.history.push(imageData);
}

private undo() {
  if (this.history.length > 1) {
    this.history.pop();
    const prevState = this.history[this.history.length - 1];
    this.ctx.putImageData(prevState, 0, 0);
  }
}
```

2. **Add Button** in `src/renderer/index.html`:
```html
<button id="undoBtn">Undo</button>
```

3. **Connect Event** in `setupEventListeners()`:
```typescript
document.getElementById('undoBtn')!.addEventListener('click', () => this.undo());
```

4. **Build and Test**:
```bash
npm run build && npm run dev
```

### Debugging

**Open DevTools:**
- Run with `npm run dev` (DevTools open automatically)
- Or add in `src/main/index.ts`: `mainWindow.webContents.openDevTools()`

**Common Issues:**

1. **App won't start**
   - Check console for errors
   - Verify `npm install` completed
   - Try `npm run clean && npm run build`

2. **Drawing not working**
   - Check canvas element exists in HTML
   - Verify event listeners are attached
   - Look for TypeScript compile errors

3. **Magnifier not showing**
   - Ensure magnifierCanvas is appended to body
   - Check CSS `display` property
   - Verify `updateMagnifier()` is called on mousemove

## System Requirements

### Development
- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher
- **macOS**: 10.13 (High Sierra) or later

### End Users
- **macOS**: 10.13 or later
- **RAM**: 4GB minimum
- **Disk**: 200MB free space
- **Permissions**: Screen Recording (for overlay)

## Build Output Sizes

```
Source Code:
- src/main/index.ts        ~1.5KB
- src/preload/index.ts     ~0.3KB
- src/renderer/app.ts      ~5KB
- src/renderer/index.html  ~1KB
- src/renderer/styles.css  ~2KB
Total: ~10KB

Compiled Build:
- dist/ folder             ~20KB

DMG Installer:
- ScreenAnnotation.dmg     ~90MB (includes Electron runtime)
```

## Scripts Reference

| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | Build & run in production | Launch app without DevTools |
| `npm run dev` | Build & run in development | Launch with DevTools open |
| `npm run build` | Clean, compile, copy files | Prepare app for running/distribution |
| `npm run clean` | Remove dist/ and release/ | Clean build artifacts |
| `npm run dist:mac` | Build & create installer | Create DMG for distribution |

## Permissions

### macOS Permissions Required

**Screen Recording**:
- Required for transparent overlay
- System Preferences → Security & Privacy → Screen Recording
- Add ScreenAnnotation.app to allowed list

**First Launch**:
- macOS may show security warning (app is unsigned)
- Right-click app → Open → Confirm
- Or: System Preferences → Security & Privacy → "Open Anyway"

## Troubleshooting

### Application Issues

**Problem**: App won't quit
- **Solution**: This version quits properly! If still stuck, force quit with Cmd+Option+Esc

**Problem**: Transparent window shows black background
- **Solution**: Check CSS `background: transparent` and Electron `transparent: true` option

**Problem**: Drawing is laggy
- **Solution**: Canvas size matches window - reduce window size or optimize render loop

### Build Issues

**Problem**: `npm run build` fails
- **Solution**:
  ```bash
  rm -rf node_modules dist
  npm install
  npm run build
  ```

**Problem**: TypeScript errors during build
- **Solution**: Check tsconfig.json has `"strict": false` and `"lib": ["ES2020", "DOM"]`

**Problem**: DMG build fails
- **Solution**: Ensure electron-builder is installed: `npm install --save-dev electron-builder`

## License

MIT License - Free for personal and commercial use

## Contributing

This is a clean, minimal implementation. When contributing:
1. Keep it simple - avoid adding complexity
2. Test thoroughly - ensure quit works properly
3. Document changes - update README if needed
4. Follow existing code style

## Version History

### 2.0.0 (Current)
- Complete rewrite for simplicity and reliability
- ✅ Brush tool with color and size controls
- ✅ Magnifier tool with 2x zoom
- ✅ Proper quit handling (no hanging processes)
- ✅ Clean codebase (~10KB)
- ✅ Fast loading and responsive

### 1.0.0 (Deprecated)
- Complex feature set with many tools
- Had issues with proper quitting
- Removed in favor of simpler approach

## Support

For issues or questions:
1. Check this README
2. Review code in `src/` directory (well-commented)
3. Open DevTools with `npm run dev` to debug

## Future Enhancements (Optional)

Possible additions without adding complexity:
- [ ] Undo/Redo (array of canvas states)
- [ ] Eraser tool
- [ ] Basic shapes (rectangle, circle)
- [ ] Save as PNG image
- [ ] Adjustable magnifier zoom level
- [ ] Keyboard shortcuts for tools

Keep it simple! ✨

---

**Built with ❤️ using Electron + TypeScript**

**Version**: 2.0.0
**Last Updated**: December 2025
**Status**: ✅ Production Ready
