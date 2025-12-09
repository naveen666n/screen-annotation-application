type WhiteboardTool = 'brush' | 'eraser' | 'text' | 'select' | 'arrow' | 'rectangle' | 'circle' | 'line' | 'roundRect' | 'star';

interface WhiteboardElectronAPI {
  saveScreenshot: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
}

interface WhiteboardHistoryState {
  imageData: ImageData;
}

class WhiteboardApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private startX = 0;
  private startY = 0;
  private currentTool: WhiteboardTool = 'brush';
  private color = '#000000';
  private size = 5;
  private fontSize = 24;

  // Background
  private backgroundColor = '#ffffff';
  private gridType: 'none' | 'dots' | 'lines' = 'none';

  // History for undo/redo
  private history: WhiteboardHistoryState[] = [];
  private historyStep = -1;
  private maxHistorySteps = 50;

  // Shape drawing
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;
  private savedImageData: ImageData | null = null;

  // Text tool
  private textInput: HTMLTextAreaElement | null = null;
  private isEditingText = false;

  // Select/Move tool
  private selectedImageData: ImageData | null = null;
  private selectionRect: { x: number; y: number; width: number; height: number } | null = null;
  private isDraggingSelection = false;
  private selectionOffsetX = 0;
  private selectionOffsetY = 0;
  private isSelecting = false;

  // Toolbar hover state
  private isMouseOverToolbar = false;

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupCanvas();
    this.setupTempCanvas();
    this.setupEventListeners();
    this.setupToolbarHoverDetection();
    this.setupToolbarToggle();
    this.saveState(); // Save initial blank state

    console.log('Whiteboard initialized successfully');
  }

  private setupCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.fillBackground();
  }

  private setupTempCanvas() {
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = this.canvas.width;
    this.tempCanvas.height = this.canvas.height;
    this.tempCtx = this.tempCanvas.getContext('2d')!;
  }

  private setupToolbarHoverDetection() {
    const toolbar = document.getElementById('toolbar')!;
    const shapesDropdown = document.getElementById('shapesDropdown')!;
    const backgroundDropdown = document.getElementById('backgroundDropdown')!;

    const setMouseOver = (isOver: boolean) => {
      this.isMouseOverToolbar = isOver;
      // Toggle canvas pointer-events
      if (isOver) {
        this.canvas.classList.add('toolbar-hovered');
      } else {
        this.canvas.classList.remove('toolbar-hovered');
      }
    };

    // Toolbar hover
    toolbar.addEventListener('mouseenter', () => setMouseOver(true));
    toolbar.addEventListener('mouseleave', () => setMouseOver(false));

    // Dropdown hovers
    shapesDropdown.addEventListener('mouseenter', () => setMouseOver(true));
    shapesDropdown.addEventListener('mouseleave', () => setMouseOver(false));
    backgroundDropdown.addEventListener('mouseenter', () => setMouseOver(true));
    backgroundDropdown.addEventListener('mouseleave', () => setMouseOver(false));
  }

  private setupToolbarToggle() {
    const toolbar = document.getElementById('toolbar')!;
    const toggleBtn = document.getElementById('toolbarToggle')!;
    const showBtn = document.getElementById('toolbarShowBtn')!;

    const toggleToolbar = () => {
      const isMinimized = toolbar.classList.contains('minimized');

      if (isMinimized) {
        // Show toolbar
        toolbar.classList.remove('minimized');
        showBtn.classList.remove('visible');
      } else {
        // Hide toolbar
        toolbar.classList.add('minimized');
        showBtn.classList.add('visible');
      }
    };

    toggleBtn.addEventListener('click', toggleToolbar);
    showBtn.addEventListener('click', toggleToolbar);

    // Keyboard shortcut: Tab key to toggle toolbar
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !this.isEditingText) {
        e.preventDefault();
        toggleToolbar();
      }
    });
  }

  private fillBackground() {
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Tool buttons
    const selectBtn = document.getElementById('selectBtn')!;
    const brushBtn = document.getElementById('brushBtn')!;
    const eraserBtn = document.getElementById('eraserBtn')!;
    const textBtn = document.getElementById('textBtn')!;
    const shapesBtn = document.getElementById('shapesBtn')!;
    const shapesDropdown = document.getElementById('shapesDropdown')!;

    selectBtn.addEventListener('click', () => this.selectTool('select'));
    brushBtn.addEventListener('click', () => this.selectTool('brush'));
    eraserBtn.addEventListener('click', () => this.selectTool('eraser'));
    textBtn.addEventListener('click', () => this.selectTool('text'));

    // Shapes dropdown
    shapesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shapesDropdown.classList.toggle('show');
      document.getElementById('backgroundDropdown')?.classList.remove('show');
    });

    // Shape options
    const shapeOptions = document.querySelectorAll('.shape-option');
    shapeOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const shape = (e.currentTarget as HTMLElement).dataset.shape as WhiteboardTool;
        this.selectTool(shape);
        shapesDropdown.classList.remove('show');
      });
    });

    // Background dropdown
    const backgroundBtn = document.getElementById('backgroundBtn')!;
    const backgroundDropdown = document.getElementById('backgroundDropdown')!;

    backgroundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      backgroundDropdown.classList.toggle('show');
      shapesDropdown.classList.remove('show');
    });

    // Background options
    const bgOptions = document.querySelectorAll('.bg-option');
    bgOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const bg = target.dataset.bg;
        const grid = target.dataset.grid as 'none' | 'dots' | 'lines';

        if (bg) {
          this.setBackgroundColor(bg);
        }
        if (grid !== undefined) {
          this.setGridType(grid);
        }

        backgroundDropdown.classList.remove('show');
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as Node;
      if (!shapesBtn.contains(target) && !shapesDropdown.contains(target)) {
        shapesDropdown.classList.remove('show');
      }
      if (!backgroundBtn.contains(target) && !backgroundDropdown.contains(target)) {
        backgroundDropdown.classList.remove('show');
      }
    });

    // Controls
    const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
    const sizeSlider = document.getElementById('sizeSlider') as HTMLInputElement;
    const fontSizeSelect = document.getElementById('fontSizeSelect') as HTMLSelectElement;
    const undoBtn = document.getElementById('undoBtn')!;
    const redoBtn = document.getElementById('redoBtn')!;
    const screenshotBtn = document.getElementById('screenshotBtn')!;
    const clearBtn = document.getElementById('clearBtn')!;

    colorPicker.addEventListener('input', (e) => {
      this.color = (e.target as HTMLInputElement).value;
    });

    sizeSlider.addEventListener('input', (e) => {
      this.size = parseInt((e.target as HTMLInputElement).value);
    });

    fontSizeSelect.addEventListener('change', (e) => {
      this.fontSize = parseInt((e.target as HTMLSelectElement).value);
    });

    undoBtn.addEventListener('click', () => this.undo());
    redoBtn.addEventListener('click', () => this.redo());
    screenshotBtn.addEventListener('click', () => this.saveImage());
    clearBtn.addEventListener('click', () => this.clear());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.redo();
      } else if (e.key === 'Escape' && this.isEditingText) {
        this.cancelTextInput();
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.fillBackground();
      this.ctx.putImageData(imageData, 0, 0);

      if (this.tempCanvas) {
        this.tempCanvas.width = this.canvas.width;
        this.tempCanvas.height = this.canvas.height;
      }
    });

    // Update undo/redo button states
    this.updateHistoryButtons();
  }

  private selectTool(tool: WhiteboardTool) {
    this.currentTool = tool;
    this.cancelTextInput();
    this.clearSelection(); // Clear any existing selection

    // Update UI
    const allToolButtons = document.querySelectorAll('.tool-btn');
    allToolButtons.forEach(btn => btn.classList.remove('active'));

    // Update canvas cursor
    this.canvas.classList.remove('text-mode', 'eraser-mode', 'select-mode');

    if (tool === 'select') {
      document.getElementById('selectBtn')?.classList.add('active');
      this.canvas.classList.add('select-mode');
      this.canvas.style.cursor = 'crosshair';
    } else if (tool === 'brush') {
      document.getElementById('brushBtn')?.classList.add('active');
    } else if (tool === 'eraser') {
      document.getElementById('eraserBtn')?.classList.add('active');
      this.canvas.classList.add('eraser-mode');
    } else if (tool === 'text') {
      document.getElementById('textBtn')?.classList.add('active');
      this.canvas.classList.add('text-mode');
    } else {
      document.getElementById('shapesBtn')?.classList.add('active');
    }

    console.log('Selected tool:', tool);
  }

  private handleMouseDown(e: MouseEvent) {
    // Don't draw if mouse is over toolbar
    if (this.isMouseOverToolbar) {
      return;
    }

    if (this.isEditingText) {
      this.finalizeTextInput();
    }

    const x = e.offsetX;
    const y = e.offsetY;

    // Handle select tool
    if (this.currentTool === 'select') {
      if (this.selectionRect && this.isInsideSelection(x, y)) {
        // Start dragging existing selection
        this.isDraggingSelection = true;
        this.selectionOffsetX = x - this.selectionRect.x;
        this.selectionOffsetY = y - this.selectionRect.y;
        this.canvas.style.cursor = 'move';
      } else {
        // Start new selection
        this.isSelecting = true;
        this.startX = x;
        this.startY = y;
        this.clearSelection();
      }
      return;
    }

    this.isDrawing = true;
    this.lastX = x;
    this.lastY = y;
    this.startX = x;
    this.startY = y;

    if (this.currentTool === 'text') {
      this.createTextInput(x, y);
      this.isDrawing = false;
    } else if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
    } else {
      // For shapes, save current canvas state
      this.savedImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const currentX = e.offsetX;
    const currentY = e.offsetY;

    // Handle selection tool
    if (this.currentTool === 'select') {
      if (this.isSelecting) {
        // Drawing selection rectangle
        this.drawSelectionRect(this.startX, this.startY, currentX, currentY);
      } else if (this.isDraggingSelection && this.selectionRect) {
        // Moving selection
        const newX = currentX - this.selectionOffsetX;
        const newY = currentY - this.selectionOffsetY;
        this.moveSelection(newX, newY);
      }
      return;
    }

    if (!this.isDrawing) return;

    if (this.currentTool === 'brush') {
      this.drawLine(this.lastX, this.lastY, currentX, currentY);
      this.lastX = currentX;
      this.lastY = currentY;
    } else if (this.currentTool === 'eraser') {
      this.erase(this.lastX, this.lastY, currentX, currentY);
      this.lastX = currentX;
      this.lastY = currentY;
    } else if (this.isShapeTool(this.currentTool)) {
      // Draw shape preview
      if (this.savedImageData) {
        this.ctx.putImageData(this.savedImageData, 0, 0);
      }
      this.drawShape(this.currentTool, this.startX, this.startY, currentX, currentY);
    }
  }

  private handleMouseUp(e: MouseEvent) {
    // Handle selection tool
    if (this.currentTool === 'select') {
      if (this.isSelecting) {
        // Finalize selection rectangle
        const x = Math.min(this.startX, e.offsetX);
        const y = Math.min(this.startY, e.offsetY);
        const width = Math.abs(e.offsetX - this.startX);
        const height = Math.abs(e.offsetY - this.startY);

        if (width > 5 && height > 5) {
          this.finalizeSelection(x, y, width, height);
        }
        this.isSelecting = false;
      } else if (this.isDraggingSelection) {
        // Finished moving selection
        this.isDraggingSelection = false;
        this.canvas.style.cursor = 'crosshair';
        if (this.selectionRect) {
          this.pasteSelection();
        }
      }
      return;
    }

    if (this.isDrawing && this.currentTool !== 'text') {
      this.isDrawing = false;
      this.saveState();
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.size;
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
  }

  private erase(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineWidth = this.size * 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = 'rgba(0,0,0,1)';

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    this.ctx.restore();
    this.lastX = x2;
    this.lastY = y2;
  }

  private isShapeTool(tool: WhiteboardTool): boolean {
    return ['arrow', 'rectangle', 'circle', 'line', 'roundRect', 'star'].includes(tool);
  }

  private drawShape(shape: WhiteboardTool, x1: number, y1: number, x2: number, y2: number) {
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.size;
    this.ctx.fillStyle = this.color;

    switch (shape) {
      case 'line':
        this.drawLineShape(x1, y1, x2, y2);
        break;
      case 'arrow':
        this.drawArrow(x1, y1, x2, y2);
        break;
      case 'rectangle':
        this.drawRectangle(x1, y1, x2, y2);
        break;
      case 'circle':
        this.drawCircle(x1, y1, x2, y2);
        break;
      case 'roundRect':
        this.drawRoundedRectangle(x1, y1, x2, y2);
        break;
      case 'star':
        this.drawStar(x1, y1, x2, y2);
        break;
    }
  }

  private drawLineShape(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number) {
    const headLength = Math.max(15, this.size * 3);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Draw line
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Draw arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  private drawRectangle(x1: number, y1: number, x2: number, y2: number) {
    const width = x2 - x1;
    const height = y2 - y1;
    this.ctx.beginPath();
    this.ctx.rect(x1, y1, width, height);
    this.ctx.stroke();
  }

  private drawCircle(x1: number, y1: number, x2: number, y2: number) {
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;
    const centerX = x1 + (x2 - x1) / 2;
    const centerY = y1 + (y2 - y1) / 2;

    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  private drawRoundedRectangle(x1: number, y1: number, x2: number, y2: number) {
    const width = x2 - x1;
    const height = y2 - y1;
    const radius = Math.min(Math.abs(width), Math.abs(height)) * 0.1;

    this.ctx.beginPath();
    this.ctx.moveTo(x1 + radius, y1);
    this.ctx.lineTo(x2 - radius, y1);
    this.ctx.quadraticCurveTo(x2, y1, x2, y1 + radius);
    this.ctx.lineTo(x2, y2 - radius);
    this.ctx.quadraticCurveTo(x2, y2, x2 - radius, y2);
    this.ctx.lineTo(x1 + radius, y2);
    this.ctx.quadraticCurveTo(x1, y2, x1, y2 - radius);
    this.ctx.lineTo(x1, y1 + radius);
    this.ctx.quadraticCurveTo(x1, y1, x1 + radius, y1);
    this.ctx.stroke();
  }

  private drawStar(x1: number, y1: number, x2: number, y2: number) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const outerRadius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2;
    const innerRadius = outerRadius * 0.4;
    const spikes = 5;

    this.ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  // Text tool implementation
  private createTextInput(x: number, y: number) {
    // Get canvas position
    const canvasRect = this.canvas.getBoundingClientRect();

    this.textInput = document.createElement('textarea');
    this.textInput.style.position = 'fixed'; // Use fixed instead of absolute
    this.textInput.style.left = (canvasRect.left + x) + 'px';
    this.textInput.style.top = (canvasRect.top + y) + 'px';
    this.textInput.style.fontSize = this.fontSize + 'px';
    this.textInput.style.color = this.color;
    this.textInput.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.textInput.style.border = '2px solid ' + this.color;
    this.textInput.style.background = 'white';
    this.textInput.style.padding = '8px';
    this.textInput.style.borderRadius = '4px';
    this.textInput.style.resize = 'none';
    this.textInput.style.outline = 'none';
    this.textInput.style.zIndex = '10001';
    this.textInput.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    this.textInput.rows = 1;
    this.textInput.cols = 20;
    this.textInput.placeholder = 'Type text here...';

    document.body.appendChild(this.textInput);

    // Use setTimeout to ensure focus happens after mouseup
    setTimeout(() => {
      if (this.textInput) {
        this.textInput.focus();
        this.isEditingText = true;
      }
    }, 50);

    console.log('Text input created at:', x, y);

    // Auto-resize textarea
    this.textInput.addEventListener('input', () => {
      if (this.textInput) {
        this.textInput.style.height = 'auto';
        this.textInput.style.height = this.textInput.scrollHeight + 'px';
      }
    });

    // Finalize on blur - but delay setup to avoid immediate blur
    setTimeout(() => {
      if (this.textInput) {
        this.textInput.addEventListener('blur', () => {
          setTimeout(() => this.finalizeTextInput(), 100);
        });
      }
    }, 100);

    // Also finalize on Enter key (without shift)
    this.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.finalizeTextInput();
      }
    });
  }

  private finalizeTextInput() {
    if (!this.textInput || !this.isEditingText) return;

    const text = this.textInput.value.trim();
    if (text) {
      // Get canvas position to convert fixed coordinates back to canvas coordinates
      const canvasRect = this.canvas.getBoundingClientRect();
      const x = parseInt(this.textInput.style.left) - canvasRect.left;
      const y = parseInt(this.textInput.style.top) - canvasRect.top;

      this.ctx.font = `${this.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      this.ctx.fillStyle = this.color;
      this.ctx.textBaseline = 'top';

      const lines = text.split('\n');
      lines.forEach((line, index) => {
        this.ctx.fillText(line, x, y + (index * this.fontSize * 1.2));
      });

      this.saveState();
      console.log('Text rendered at canvas coords:', x, y);
    }

    this.cancelTextInput();
  }

  private cancelTextInput() {
    if (this.textInput) {
      this.textInput.remove();
      this.textInput = null;
    }
    this.isEditingText = false;
  }

  // History management (undo/redo)
  private saveState() {
    // Remove any states after current step (when user makes new action after undo)
    if (this.historyStep < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyStep + 1);
    }

    // Save current state
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.history.push({ imageData });
    this.historyStep++;

    // Limit history size
    if (this.history.length > this.maxHistorySteps) {
      this.history.shift();
      this.historyStep--;
    }

    this.updateHistoryButtons();
  }

  private undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      const state = this.history[this.historyStep];
      this.ctx.putImageData(state.imageData, 0, 0);
      this.updateHistoryButtons();
    }
  }

  private redo() {
    if (this.historyStep < this.history.length - 1) {
      this.historyStep++;
      const state = this.history[this.historyStep];
      this.ctx.putImageData(state.imageData, 0, 0);
      this.updateHistoryButtons();
    }
  }

  private updateHistoryButtons() {
    const undoBtn = document.getElementById('undoBtn')!;
    const redoBtn = document.getElementById('redoBtn')!;

    if (this.historyStep > 0) {
      undoBtn.removeAttribute('disabled');
    } else {
      undoBtn.setAttribute('disabled', 'true');
    }

    if (this.historyStep < this.history.length - 1) {
      redoBtn.removeAttribute('disabled');
    } else {
      redoBtn.setAttribute('disabled', 'true');
    }
  }

  // Background management
  private setBackgroundColor(color: string) {
    this.backgroundColor = color;

    // Save current drawing
    const tempImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // Clear and set new background
    document.body.style.backgroundColor = color;
    this.fillBackground();

    // Restore drawing
    this.ctx.putImageData(tempImageData, 0, 0);
    this.saveState();
  }

  private setGridType(type: 'none' | 'dots' | 'lines') {
    this.gridType = type;
    document.body.classList.remove('grid-dots', 'grid-lines');

    if (type === 'dots') {
      document.body.classList.add('grid-dots');
    } else if (type === 'lines') {
      document.body.classList.add('grid-lines');
    }
  }

  // Utility methods
  private clear() {
    if (confirm('Are you sure you want to clear the whiteboard?')) {
      this.fillBackground();
      this.saveState();
    }
  }

  private async saveImage() {
    try {
      const electronAPI = (window as any).electronAPI as WhiteboardElectronAPI;
      if (electronAPI && electronAPI.saveScreenshot) {
        const dataUrl = this.canvas.toDataURL('image/png');
        const result = await electronAPI.saveScreenshot(dataUrl);

        // Visual feedback
        const screenshotBtn = document.getElementById('screenshotBtn')!;
        if (result.success) {
          screenshotBtn.style.backgroundColor = 'rgba(52, 199, 89, 0.6)';
          setTimeout(() => {
            screenshotBtn.style.backgroundColor = '';
          }, 300);
        } else if (!result.canceled) {
          console.error('Failed to save image:', result.error);
        }
      }
    } catch (error) {
      console.error('Error saving image:', error);
    }
  }

  // Selection/Move tool helper methods
  private clearSelection() {
    this.selectedImageData = null;
    this.selectionRect = null;
    this.isSelecting = false;
    this.isDraggingSelection = false;
  }

  private isInsideSelection(x: number, y: number): boolean {
    if (!this.selectionRect) return false;
    return x >= this.selectionRect.x &&
           x <= this.selectionRect.x + this.selectionRect.width &&
           y >= this.selectionRect.y &&
           y <= this.selectionRect.y + this.selectionRect.height;
  }

  private drawSelectionRect(x1: number, y1: number, x2: number, y2: number) {
    if (!this.savedImageData) {
      this.savedImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    this.ctx.putImageData(this.savedImageData, 0, 0);

    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    this.ctx.strokeStyle = '#4287f5';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
  }

  private finalizeSelection(x: number, y: number, width: number, height: number) {
    this.selectionRect = { x, y, width, height };
    this.selectedImageData = this.ctx.getImageData(x, y, width, height);

    // Clear the selected area
    this.ctx.clearRect(x, y, width, height);
    this.fillBackground();

    if (this.savedImageData) {
      // Restore everything except selected area
      this.ctx.putImageData(this.savedImageData, 0, 0);
      this.ctx.clearRect(x, y, width, height);
      this.fillBackgroundRect(x, y, width, height);
    }

    // Draw selection with dashed border
    if (this.selectedImageData) {
      this.ctx.putImageData(this.selectedImageData, x, y);
    }
    this.ctx.strokeStyle = '#4287f5';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);

    this.savedImageData = null;
  }

  private fillBackgroundRect(x: number, y: number, width: number, height: number) {
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(x, y, width, height);
  }

  private moveSelection(newX: number, newY: number) {
    if (!this.selectionRect || !this.selectedImageData) return;

    const oldRect = this.selectionRect;
    this.selectionRect = {
      x: newX,
      y: newY,
      width: oldRect.width,
      height: oldRect.height
    };

    // Redraw canvas
    if (this.savedImageData) {
      this.ctx.putImageData(this.savedImageData, 0, 0);
      this.ctx.clearRect(oldRect.x, oldRect.y, oldRect.width, oldRect.height);
      this.fillBackgroundRect(oldRect.x, oldRect.y, oldRect.width, oldRect.height);
    } else {
      this.fillBackground();
    }

    // Draw selection at new position
    this.ctx.putImageData(this.selectedImageData, newX, newY);
    this.ctx.strokeStyle = '#4287f5';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(newX, newY, oldRect.width, oldRect.height);
    this.ctx.setLineDash([]);
  }

  private pasteSelection() {
    if (!this.selectionRect || !this.selectedImageData) return;

    // Finalize the paste
    this.ctx.putImageData(this.selectedImageData, this.selectionRect.x, this.selectionRect.y);
    this.clearSelection();
    this.saveState();
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new WhiteboardApp();
  });
} else {
  new WhiteboardApp();
}
