import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let whiteboardWindow: BrowserWindow | null = null;
let isPassThroughEnabled = false;
let isMouseOverToolbar = false;

function createWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    movable: false,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  // Set the window to be always on top at the highest level
  // Use 'floating' level for better compatibility with fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'floating', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setFullScreenable(false);

  // Additional settings for macOS to ensure overlay stays on top
  if (process.platform === 'darwin') {
    app.dock.hide(); // Hide from dock for cleaner UI

    // Set window level to maximum to stay above fullscreen apps
    // @ts-ignore - macOS specific API
    if (mainWindow.setWindowButtonVisibility) {
      // @ts-ignore
      mainWindow.setWindowButtonVisibility(false);
    }
  }

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Handle window close - IMPORTANT: Actually close the window
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createWhiteboardWindow() {
  // Don't create multiple whiteboard windows
  if (whiteboardWindow && !whiteboardWindow.isDestroyed()) {
    whiteboardWindow.focus();
    return;
  }

  whiteboardWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#ffffff',
    title: 'Whiteboard',
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,
    alwaysOnTop: false, // Normal window, not always on top
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  whiteboardWindow.loadFile(path.join(__dirname, '../renderer/whiteboard.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    whiteboardWindow.webContents.openDevTools({ mode: 'detach' });
  }

  whiteboardWindow.on('closed', () => {
    whiteboardWindow = null;
  });
}

// Create window when app is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle click-through toggle
ipcMain.on('toggle-click-through', (event, enabled: boolean) => {
  isPassThroughEnabled = enabled;
  updateMouseEvents();
});

// Handle mouse over toolbar
ipcMain.on('mouse-over-toolbar', (event, isOver: boolean) => {
  isMouseOverToolbar = isOver;
  updateMouseEvents();
});

// Update mouse event handling based on state
function updateMouseEvents() {
  if (!mainWindow) return;

  if (isPassThroughEnabled) {
    // If pass-through is enabled but mouse is over toolbar, capture events
    if (isMouseOverToolbar) {
      mainWindow.setIgnoreMouseEvents(false);
    } else {
      // Mouse is not over toolbar, enable click-through
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  } else {
    // Pass-through is disabled, always capture events
    mainWindow.setIgnoreMouseEvents(false);
  }
}

// Handle screenshot save
ipcMain.handle('save-screenshot', async (event, dataUrl: string) => {
  try {
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Screenshot',
      defaultPath: `screenshot-${Date.now()}.png`,
      filters: [
        { name: 'PNG Images', extensions: ['png'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    // Convert data URL to buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Write file
    fs.writeFileSync(result.filePath, buffer);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error saving screenshot:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle open whiteboard
ipcMain.on('open-whiteboard', () => {
  createWhiteboardWindow();
});

// Quit when all windows are closed (works on all platforms)
app.on('window-all-closed', () => {
  app.quit();
});

// Handle quit properly
app.on('before-quit', () => {
  // Clean up any resources here
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  if (whiteboardWindow) {
    whiteboardWindow.destroy();
    whiteboardWindow = null;
  }
});
