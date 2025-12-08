import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
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
  // Use 'pop-up-menu' level to ensure it appears over fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setFullScreenable(false);

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
});
