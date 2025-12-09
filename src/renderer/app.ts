type Tool = 'brush' | 'select' | 'eraser' | 'text' | 'magnifier' | 'highlighter' | 'laserPointer' | 'arrow' | 'rectangle' | 'circle' | 'line' | 'roundRect' | 'star';

interface ElectronAPI {
  toggleClickThrough: (enabled: boolean) => void;
  setMouseOverToolbar: (isOver: boolean) => void;
  saveScreenshot: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  openWhiteboard: () => void;
}

interface DrawObject {
  type: 'brush' | 'shape' | 'text';
  tool: Tool;
  color: string;
  size: number;
  points?: Array<{ x: number; y: number }>; // For brush strokes
  startX?: number; // For shapes
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string; // For text objects
  fontSize?: number;
  x?: number; // Position for text
  y?: number;
  bounds?: { x: number; y: number; width: number; height: number }; // Bounding box for hit testing
}

class ScreenAnnotationApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private startX = 0;
  private startY = 0;
  private currentTool: Tool = 'brush';
  private color = '#ff0000';
  private size = 5;

  // Magnifier properties
  private magnifierCanvas: HTMLCanvasElement | null = null;
  private magnifierCtx: CanvasRenderingContext2D | null = null;
  private magnification = 2;
  private magnifierSize = 200;

  // Highlighter properties
  private highlighterCanvas: HTMLCanvasElement | null = null;
  private highlighterCtx: CanvasRenderingContext2D | null = null;
  private highlighterSizeMultiplier = 10; // Multiplier to scale the size slider value

  // Laser pointer properties
  private laserPointerCanvas: HTMLCanvasElement | null = null;
  private laserPointerCtx: CanvasRenderingContext2D | null = null;
  private laserTrail: Array<{ x: number; y: number; age: number }> = [];
  private laserPointerSizeMultiplier = 2; // Multiplier to scale the size slider value
  private maxTrailLength = 15;

  // Keyboard display properties
  private isKeyDisplayEnabled = false;
  private keyDisplayContainer: HTMLDivElement | null = null;
  private activeKeys: Map<string, HTMLDivElement> = new Map();
  private keyDisplayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right';

  // Shape drawing properties
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;
  private savedImageData: ImageData | null = null;

  // Click-through mode
  private isPassThroughEnabled = false;

  // Select/Move tool
  private selectedImageData: ImageData | null = null;
  private selectionRect: { x: number; y: number; width: number; height: number } | null = null;
  private isDraggingSelection = false;
  private selectionOffsetX = 0;
  private selectionOffsetY = 0;
  private isSelecting = false;

  // Toolbar hover state
  private isMouseOverToolbar = false;

  // Advanced features (available for both overlay and whiteboard)
  private history: ImageData[] = [];
  private historyStep = -1;
  private fontSize = 24;
  private textInput: HTMLTextAreaElement | null = null;
  private isEditingText = false;
  private currentBackground = 'transparent';
  private currentGrid = 'none';

  // Object-based drawing for draggable items
  private drawnObjects: DrawObject[] = [];
  private selectedObject: DrawObject | null = null;
  private isDraggingObject = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private currentStroke: DrawObject | null = null; // For tracking brush strokes in progress

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupCanvas();
    this.setupEventListeners();
    this.setupMagnifier();
    this.setupHighlighter();
    this.setupLaserPointer();
    this.setupKeyDisplay();
    this.setupTempCanvas();
    this.setupToolbarDragging();

    // Initialize history
    this.saveState();

    console.log('App initialized successfully');
  }

  private setupTempCanvas() {
    // Create temporary canvas for shape preview
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = this.canvas.width;
    this.tempCanvas.height = this.canvas.height;
    this.tempCtx = this.tempCanvas.getContext('2d')!;
  }

  private setupToolbarDragging() {
    const toolbar = document.getElementById('toolbar')!;
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;

    toolbar.addEventListener('mousedown', (e: MouseEvent) => {
      // Don't drag if clicking on buttons or inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' ||
          target.tagName === 'svg' || target.tagName === 'path' ||
          target.tagName === 'circle' || target.tagName === 'line' ||
          target.tagName === 'polyline' || target.tagName === 'polygon' ||
          target.tagName === 'rect' || target.tagName === 'SPAN') {
        return;
      }

      isDragging = true;
      toolbar.classList.add('dragging');

      // Get current toolbar position
      const rect = toolbar.getBoundingClientRect();
      initialX = e.clientX - rect.left + toolbar.offsetLeft - rect.width / 2;
      initialY = e.clientY - rect.top + toolbar.offsetTop;
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;

      e.preventDefault();

      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      // Update toolbar position
      toolbar.style.left = currentX + 'px';
      toolbar.style.top = currentY + 'px';
      toolbar.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        toolbar.classList.remove('dragging');
      }
    });
  }

  private setupCanvas() {
    // Set canvas size to window size
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Setup context
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  private setupMagnifier() {
    // Create magnifier canvas
    this.magnifierCanvas = document.createElement('canvas');
    this.magnifierCanvas.id = 'magnifierCanvas';
    this.magnifierCanvas.width = this.magnifierSize;
    this.magnifierCanvas.height = this.magnifierSize;
    this.magnifierCanvas.style.position = 'absolute';
    this.magnifierCanvas.style.border = '3px solid #4287f5';
    this.magnifierCanvas.style.borderRadius = '50%';
    this.magnifierCanvas.style.display = 'none';
    this.magnifierCanvas.style.pointerEvents = 'none';
    this.magnifierCanvas.style.zIndex = '9999';

    document.body.appendChild(this.magnifierCanvas);
    this.magnifierCtx = this.magnifierCanvas.getContext('2d')!;
  }

  private setupHighlighter() {
    // Create highlighter canvas overlay
    this.highlighterCanvas = document.createElement('canvas');
    this.highlighterCanvas.id = 'highlighterCanvas';
    this.highlighterCanvas.width = window.innerWidth;
    this.highlighterCanvas.height = window.innerHeight;
    this.highlighterCanvas.style.position = 'absolute';
    this.highlighterCanvas.style.top = '0';
    this.highlighterCanvas.style.left = '0';
    this.highlighterCanvas.style.display = 'none';
    this.highlighterCanvas.style.pointerEvents = 'none';
    this.highlighterCanvas.style.zIndex = '9998';

    document.body.appendChild(this.highlighterCanvas);
    this.highlighterCtx = this.highlighterCanvas.getContext('2d')!;
  }

  private setupLaserPointer() {
    // Create laser pointer canvas overlay
    this.laserPointerCanvas = document.createElement('canvas');
    this.laserPointerCanvas.id = 'laserPointerCanvas';
    this.laserPointerCanvas.width = window.innerWidth;
    this.laserPointerCanvas.height = window.innerHeight;
    this.laserPointerCanvas.style.position = 'absolute';
    this.laserPointerCanvas.style.top = '0';
    this.laserPointerCanvas.style.left = '0';
    this.laserPointerCanvas.style.display = 'none';
    this.laserPointerCanvas.style.pointerEvents = 'none';
    this.laserPointerCanvas.style.zIndex = '9997';

    document.body.appendChild(this.laserPointerCanvas);
    this.laserPointerCtx = this.laserPointerCanvas.getContext('2d')!;

    // Start animation loop for laser pointer
    this.animateLaserPointer();
  }

  private setupKeyDisplay() {
    // Create keyboard display container
    this.keyDisplayContainer = document.createElement('div');
    this.keyDisplayContainer.id = 'keyDisplayContainer';
    this.keyDisplayContainer.style.position = 'fixed';
    this.keyDisplayContainer.style.display = 'flex';
    this.keyDisplayContainer.style.flexWrap = 'wrap';
    this.keyDisplayContainer.style.gap = '8px';
    this.keyDisplayContainer.style.zIndex = '10002';
    this.keyDisplayContainer.style.pointerEvents = 'none';
    this.keyDisplayContainer.style.padding = '20px';

    this.updateKeyDisplayPosition();

    document.body.appendChild(this.keyDisplayContainer);

    // Add keyboard event listeners
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private updateKeyDisplayPosition() {
    if (!this.keyDisplayContainer) return;

    switch (this.keyDisplayPosition) {
      case 'top-left':
        this.keyDisplayContainer.style.top = '0';
        this.keyDisplayContainer.style.left = '0';
        this.keyDisplayContainer.style.bottom = 'auto';
        this.keyDisplayContainer.style.right = 'auto';
        break;
      case 'top-right':
        this.keyDisplayContainer.style.top = '0';
        this.keyDisplayContainer.style.right = '0';
        this.keyDisplayContainer.style.bottom = 'auto';
        this.keyDisplayContainer.style.left = 'auto';
        break;
      case 'bottom-left':
        this.keyDisplayContainer.style.bottom = '0';
        this.keyDisplayContainer.style.left = '0';
        this.keyDisplayContainer.style.top = 'auto';
        this.keyDisplayContainer.style.right = 'auto';
        break;
      case 'bottom-right':
        this.keyDisplayContainer.style.bottom = '0';
        this.keyDisplayContainer.style.right = '0';
        this.keyDisplayContainer.style.top = 'auto';
        this.keyDisplayContainer.style.left = 'auto';
        break;
    }
  }

  private setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Tool buttons
    const brushBtn = document.getElementById('brushBtn')!;
    const selectBtn = document.getElementById('selectBtn')!;
    const eraserBtn = document.getElementById('eraserBtn')!;
    const textBtn = document.getElementById('textBtn')!;
    const magnifierBtn = document.getElementById('magnifierBtn')!;
    const highlighterBtn = document.getElementById('highlighterBtn')!;
    const laserPointerBtn = document.getElementById('laserPointerBtn')!;
    const shapesBtn = document.getElementById('shapesBtn')!;
    const shapesDropdown = document.getElementById('shapesDropdown')!;
    const moreToolsBtn = document.getElementById('moreToolsBtn')!;
    const moreToolsDropdown = document.getElementById('moreToolsDropdown')!;

    brushBtn.addEventListener('click', () => this.selectTool('brush'));
    selectBtn.addEventListener('click', () => this.selectTool('select'));
    eraserBtn.addEventListener('click', () => this.selectTool('eraser'));
    textBtn.addEventListener('click', () => this.selectTool('text'));
    magnifierBtn.addEventListener('click', () => this.selectTool('magnifier'));
    highlighterBtn.addEventListener('click', () => this.selectTool('highlighter'));
    laserPointerBtn.addEventListener('click', () => this.selectTool('laserPointer'));

    // Shapes dropdown toggle
    shapesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shapesDropdown.classList.toggle('show');
    });

    // Shape options
    const shapeOptions = document.querySelectorAll('.shape-option');
    shapeOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const shape = (e.currentTarget as HTMLElement).dataset.shape as Tool;
        this.selectTool(shape);
        shapesDropdown.classList.remove('show');
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!shapesBtn.contains(e.target as Node) && !shapesDropdown.contains(e.target as Node)) {
        shapesDropdown.classList.remove('show');
      }
    });

    // More Tools dropdown toggle
    moreToolsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moreToolsDropdown.classList.toggle('show');
    });

    // More Tools options
    const keyDisplayOption = document.getElementById('keyDisplayOption')!;
    keyDisplayOption.addEventListener('click', () => {
      this.toggleKeyDisplay();
      moreToolsDropdown.classList.remove('show');

      // Toggle active state on the option
      keyDisplayOption.classList.toggle('active');
    });

    // Close more tools dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!moreToolsBtn.contains(e.target as Node) && !moreToolsDropdown.contains(e.target as Node)) {
        moreToolsDropdown.classList.remove('show');
      }
    });

    // Controls
    const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
    const sizeSlider = document.getElementById('sizeSlider') as HTMLInputElement;
    const fontSizeSelect = document.getElementById('fontSizeSelect') as HTMLSelectElement;
    const whiteboardBtn = document.getElementById('whiteboardBtn')!;
    const passThroughBtn = document.getElementById('passThroughBtn')!;
    const screenshotBtn = document.getElementById('screenshotBtn')!;
    const clearBtn = document.getElementById('clearBtn')!;
    const quitBtn = document.getElementById('quitBtn')!;

    colorPicker.addEventListener('input', (e) => {
      this.color = (e.target as HTMLInputElement).value;
    });
    sizeSlider.addEventListener('input', (e) => {
      this.size = parseInt((e.target as HTMLInputElement).value);
    });
    fontSizeSelect.addEventListener('change', (e) => {
      this.fontSize = parseInt((e.target as HTMLSelectElement).value);
    });
    whiteboardBtn.addEventListener('click', () => this.openWhiteboard());
    passThroughBtn.addEventListener('click', () => this.togglePassThrough());
    screenshotBtn.addEventListener('click', () => this.takeScreenshot());
    clearBtn.addEventListener('click', () => this.clear());
    quitBtn.addEventListener('click', () => this.quit());

    // Whiteboard-specific controls
    const undoBtn = document.getElementById('undoBtn')!;
    const redoBtn = document.getElementById('redoBtn')!;
    const backgroundBtn = document.getElementById('backgroundBtn')!;
    const backgroundDropdown = document.getElementById('backgroundDropdown')!;

    undoBtn.addEventListener('click', () => this.undo());
    redoBtn.addEventListener('click', () => this.redo());

    // Background dropdown toggle
    backgroundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      backgroundDropdown.classList.toggle('show');
    });

    // Background options
    const bgOptions = document.querySelectorAll('.bg-option');
    bgOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const bg = target.dataset.bg;
        const grid = target.dataset.grid;

        if (bg) {
          this.changeBackground(bg);
        } else if (grid) {
          this.changeGrid(grid);
        }

        backgroundDropdown.classList.remove('show');
      });
    });

    // Close background dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!backgroundBtn.contains(e.target as Node) && !backgroundDropdown.contains(e.target as Node)) {
        backgroundDropdown.classList.remove('show');
      }
    });

    // Track mouse over toolbar for pass-through mode and drawing prevention
    const toolbar = document.getElementById('toolbar')!;
    const electronAPI = (window as any).electronAPI as ElectronAPI;

    toolbar.addEventListener('mouseenter', () => {
      this.isMouseOverToolbar = true;
      if (electronAPI) {
        electronAPI.setMouseOverToolbar(true);
      }
    });

    toolbar.addEventListener('mouseleave', () => {
      this.isMouseOverToolbar = false;
      if (electronAPI) {
        electronAPI.setMouseOverToolbar(false);
      }
    });

    // Also track shapes dropdown
    shapesDropdown.addEventListener('mouseenter', () => {
      this.isMouseOverToolbar = true;
    });

    shapesDropdown.addEventListener('mouseleave', () => {
      this.isMouseOverToolbar = false;
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.setupCanvas();
      if (this.tempCanvas) {
        this.tempCanvas.width = this.canvas.width;
        this.tempCanvas.height = this.canvas.height;
      }
      if (this.highlighterCanvas) {
        this.highlighterCanvas.width = window.innerWidth;
        this.highlighterCanvas.height = window.innerHeight;
      }
    });
  }

  private selectTool(tool: Tool) {
    // Finalize any ongoing actions before switching tools
    if (this.isEditingText) {
      this.finalizeTextInput();
    }

    // If currently drawing, stop drawing
    if (this.isDrawing) {
      this.isDrawing = false;
      this.savedImageData = null;
    }

    // If selecting, clear the selection state
    if (this.isSelecting) {
      this.isSelecting = false;
      if (this.savedImageData) {
        this.ctx.putImageData(this.savedImageData, 0, 0);
        this.savedImageData = null;
      }
    }

    this.currentTool = tool;

    // Update UI - remove active class from all tool buttons
    const allToolButtons = document.querySelectorAll('.tool-btn');
    allToolButtons.forEach(btn => btn.classList.remove('active'));

    // Remove active class from all shape options
    const allShapeOptions = document.querySelectorAll('.shape-option');
    allShapeOptions.forEach(opt => opt.classList.remove('active'));

    // Determine which button to activate
    const shapeTools: Tool[] = ['arrow', 'rectangle', 'circle', 'line', 'roundRect', 'star'];

    if (tool === 'brush') {
      document.getElementById('brushBtn')?.classList.add('active');
    } else if (tool === 'select') {
      document.getElementById('selectBtn')?.classList.add('active');
      // Clear any existing selection when switching to select tool
      this.clearSelection();
    } else if (tool === 'eraser') {
      document.getElementById('eraserBtn')?.classList.add('active');
    } else if (tool === 'text') {
      document.getElementById('textBtn')?.classList.add('active');
    } else if (tool === 'magnifier') {
      document.getElementById('magnifierBtn')?.classList.add('active');
    } else if (tool === 'highlighter') {
      document.getElementById('highlighterBtn')?.classList.add('active');
    } else if (tool === 'laserPointer') {
      document.getElementById('laserPointerBtn')?.classList.add('active');
    } else if (shapeTools.includes(tool)) {
      document.getElementById('shapesBtn')?.classList.add('active');
      // Highlight selected shape in dropdown
      const selectedOption = document.querySelector(`.shape-option[data-shape="${tool}"]`);
      selectedOption?.classList.add('active');
    }

    // Hide magnifier when switching away from it
    if (tool !== 'magnifier' && this.magnifierCanvas) {
      this.magnifierCanvas.style.display = 'none';
    }

    // Hide highlighter when switching away from it
    if (tool !== 'highlighter' && this.highlighterCanvas) {
      this.highlighterCanvas.style.display = 'none';
    }

    // Show highlighter when switching to it
    if (tool === 'highlighter' && this.highlighterCanvas) {
      this.highlighterCanvas.style.display = 'block';
    }

    // Hide laser pointer when switching away from it
    if (tool !== 'laserPointer' && this.laserPointerCanvas) {
      this.laserPointerCanvas.style.display = 'none';
      this.laserTrail = [];
    }

    // Show laser pointer when switching to it
    if (tool === 'laserPointer' && this.laserPointerCanvas) {
      this.laserPointerCanvas.style.display = 'block';
    }

    // Set appropriate cursor
    if (shapeTools.includes(tool)) {
      this.canvas.style.cursor = 'crosshair';
    } else if (tool === 'brush') {
      this.canvas.style.cursor = 'crosshair';
    } else if (tool === 'select') {
      this.canvas.style.cursor = 'default';
    } else if (tool === 'eraser') {
      this.canvas.style.cursor = 'pointer';
    } else if (tool === 'text') {
      this.canvas.style.cursor = 'text';
    } else if (tool === 'magnifier') {
      this.canvas.style.cursor = 'zoom-in';
    } else if (tool === 'highlighter') {
      this.canvas.style.cursor = 'none';
    } else if (tool === 'laserPointer') {
      this.canvas.style.cursor = 'none';
    }
  }

  private handleMouseDown(e: MouseEvent) {
    // Don't draw if mouse is over toolbar
    if (this.isMouseOverToolbar) {
      return;
    }

    const shapeTools: Tool[] = ['arrow', 'rectangle', 'circle', 'line', 'roundRect', 'star'];

    if (this.currentTool === 'select') {
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // First check if clicking on a drawn object
      const hitObject = this.hitTestObject(mouseX, mouseY);
      if (hitObject) {
        // Start dragging the object
        this.selectedObject = hitObject;
        this.isDraggingObject = true;
        this.dragOffsetX = mouseX - (hitObject.bounds?.x || 0);
        this.dragOffsetY = mouseY - (hitObject.bounds?.y || 0);
        this.canvas.style.cursor = 'move';
      } else if (this.selectionRect && this.isInsideSelection(mouseX, mouseY)) {
        // Check if clicking inside existing rectangular selection
        this.isDraggingSelection = true;
        this.selectionOffsetX = mouseX - this.selectionRect.x;
        this.selectionOffsetY = mouseY - this.selectionRect.y;
        this.canvas.style.cursor = 'move';
      } else {
        // Start new rectangular selection
        this.clearSelection();
        this.isSelecting = true;
        this.startX = mouseX;
        this.startY = mouseY;
        this.savedImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      }
    } else if (this.currentTool === 'brush') {
      this.isDrawing = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      // Create new stroke object
      this.currentStroke = {
        type: 'brush',
        tool: 'brush',
        color: this.color,
        size: this.size,
        points: [{ x: this.lastX, y: this.lastY }]
      };

      // Draw initial dot
      this.ctx.beginPath();
      this.ctx.arc(this.lastX, this.lastY, this.size / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = this.color;
      this.ctx.fill();
    } else if (this.currentTool === 'eraser') {
      this.isDrawing = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      // Save state for undo
      this.saveState();
    } else if (this.currentTool === 'text') {
      // Create text input at click position
      this.createTextInput(e.clientX, e.clientY);
    } else if (shapeTools.includes(this.currentTool)) {
      // Start shape drawing
      this.isDrawing = true;
      this.startX = e.clientX;
      this.startY = e.clientY;

      // Save current canvas state
      this.savedImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const shapeTools: Tool[] = ['arrow', 'rectangle', 'circle', 'line', 'roundRect', 'star'];

    if (this.currentTool === 'select') {
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      if (this.isDraggingObject && this.selectedObject) {
        // Move the object
        const newX = mouseX - this.dragOffsetX;
        const newY = mouseY - this.dragOffsetY;
        const deltaX = newX - (this.selectedObject.bounds?.x || 0);
        const deltaY = newY - (this.selectedObject.bounds?.y || 0);

        // Update object position
        this.moveObject(this.selectedObject, deltaX, deltaY);

        // Redraw canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.redrawAllObjects();
      } else if (this.isSelecting && this.savedImageData) {
        // Draw selection rectangle preview
        this.ctx.putImageData(this.savedImageData, 0, 0);
        this.redrawAllObjects();
        this.drawSelectionRect(this.startX, this.startY, mouseX, mouseY);
      } else if (this.isDraggingSelection && this.selectionRect && this.selectedImageData) {
        // Move the rectangular selection
        const newX = mouseX - this.selectionOffsetX;
        const newY = mouseY - this.selectionOffsetY;
        this.moveSelection(newX, newY);
      } else {
        // Check if hovering over any object or selection
        const hitObject = this.hitTestObject(mouseX, mouseY);
        if (hitObject || (this.selectionRect && this.isInsideSelection(mouseX, mouseY))) {
          this.canvas.style.cursor = 'move';
        } else {
          this.canvas.style.cursor = 'default';
        }
      }
    } else if (this.currentTool === 'brush' && this.isDrawing) {
      // Add point to current stroke
      if (this.currentStroke && this.currentStroke.points) {
        this.currentStroke.points.push({ x: e.clientX, y: e.clientY });
      }

      this.drawLine(this.lastX, this.lastY, e.clientX, e.clientY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    } else if (this.currentTool === 'eraser' && this.isDrawing) {
      this.erase(this.lastX, this.lastY, e.clientX, e.clientY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    } else if (shapeTools.includes(this.currentTool) && this.isDrawing && this.savedImageData) {
      // Show shape preview
      // Restore canvas to saved state
      this.ctx.putImageData(this.savedImageData, 0, 0);

      // Draw preview shape
      this.drawShape(this.startX, this.startY, e.clientX, e.clientY, this.currentTool);
    } else if (this.currentTool === 'magnifier') {
      this.updateMagnifier(e.clientX, e.clientY);
    } else if (this.currentTool === 'highlighter') {
      this.updateHighlighter(e.clientX, e.clientY);
    } else if (this.currentTool === 'laserPointer') {
      this.updateLaserPointer(e.clientX, e.clientY);
    }
  }

  private handleMouseUp(e: MouseEvent) {
    const shapeTools: Tool[] = ['arrow', 'rectangle', 'circle', 'line', 'roundRect', 'star'];

    if (this.currentTool === 'select') {
      if (this.isDraggingObject) {
        // Finished dragging object
        this.isDraggingObject = false;
        this.selectedObject = null;
        this.canvas.style.cursor = 'default';
        this.saveState();
      } else if (this.isSelecting) {
        // Finalize selection
        const x = Math.min(this.startX, e.clientX);
        const y = Math.min(this.startY, e.clientY);
        const width = Math.abs(e.clientX - this.startX);
        const height = Math.abs(e.clientY - this.startY);

        if (width > 5 && height > 5) {
          this.finalizeSelection(x, y, width, height);
        } else {
          // Selection too small, clear it
          if (this.savedImageData) {
            this.ctx.putImageData(this.savedImageData, 0, 0);
          }
        }

        this.isSelecting = false;
        this.savedImageData = null;
      } else if (this.isDraggingSelection) {
        // Paste selection
        this.pasteSelection();
        this.isDraggingSelection = false;
        this.canvas.style.cursor = 'default';
      }
    } else if (this.currentTool === 'brush' && this.isDrawing) {
      this.isDrawing = false;

      // Save the completed brush stroke as an object
      if (this.currentStroke && this.currentStroke.points && this.currentStroke.points.length > 0) {
        this.currentStroke.bounds = this.calculateStrokeBounds(this.currentStroke.points, this.currentStroke.size);
        this.drawnObjects.push(this.currentStroke);
        this.currentStroke = null;
        this.saveState();
      }
    } else if (this.currentTool === 'eraser') {
      this.isDrawing = false;
    } else if (shapeTools.includes(this.currentTool) && this.isDrawing) {
      // Finalize shape drawing and save as object
      this.isDrawing = false;

      const shapeObject: DrawObject = {
        type: 'shape',
        tool: this.currentTool,
        color: this.color,
        size: this.size,
        startX: this.startX,
        startY: this.startY,
        endX: e.clientX,
        endY: e.clientY,
        bounds: this.calculateShapeBounds(this.startX, this.startY, e.clientX, e.clientY, this.currentTool)
      };

      this.drawnObjects.push(shapeObject);
      this.savedImageData = null;
      this.saveState();
    }
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.size;
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  private drawShape(startX: number, startY: number, endX: number, endY: number, shape: Tool) {
    this.ctx.strokeStyle = this.color;
    this.ctx.fillStyle = this.color;
    this.ctx.lineWidth = this.size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    switch (shape) {
      case 'line':
        this.drawLineShape(startX, startY, endX, endY);
        break;
      case 'arrow':
        this.drawArrow(startX, startY, endX, endY);
        break;
      case 'rectangle':
        this.drawRectangle(startX, startY, endX, endY);
        break;
      case 'circle':
        this.drawCircle(startX, startY, endX, endY);
        break;
      case 'roundRect':
        this.drawRoundedRectangle(startX, startY, endX, endY);
        break;
      case 'star':
        this.drawStar(startX, startY, endX, endY);
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
    const headLength = 20 + this.size * 2;
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
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;

    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  private drawRoundedRectangle(x1: number, y1: number, x2: number, y2: number) {
    const width = x2 - x1;
    const height = y2 - y1;
    const radius = Math.min(Math.abs(width), Math.abs(height)) * 0.15;

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
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawStar(x1: number, y1: number, x2: number, y2: number) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radius = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 2;
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius * 0.4;

    this.ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private updateMagnifier(mouseX: number, mouseY: number) {
    if (!this.magnifierCanvas || !this.magnifierCtx) return;

    // Show magnifier
    this.magnifierCanvas.style.display = 'block';

    // Position magnifier near cursor
    const offsetX = 30;
    const offsetY = 30;
    this.magnifierCanvas.style.left = (mouseX + offsetX) + 'px';
    this.magnifierCanvas.style.top = (mouseY + offsetY) + 'px';

    // Clear magnifier canvas
    this.magnifierCtx.clearRect(0, 0, this.magnifierSize, this.magnifierSize);

    // Calculate source area
    const sourceSize = this.magnifierSize / this.magnification;
    const sourceX = mouseX - sourceSize / 2;
    const sourceY = mouseY - sourceSize / 2;

    // Create circular clip
    this.magnifierCtx.save();
    this.magnifierCtx.beginPath();
    this.magnifierCtx.arc(
      this.magnifierSize / 2,
      this.magnifierSize / 2,
      this.magnifierSize / 2 - 5,
      0,
      Math.PI * 2
    );
    this.magnifierCtx.clip();

    // Draw magnified content from main canvas
    this.magnifierCtx.drawImage(
      this.canvas,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      this.magnifierSize,
      this.magnifierSize
    );

    this.magnifierCtx.restore();

    // Draw crosshair
    this.magnifierCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.magnifierCtx.lineWidth = 1;
    this.magnifierCtx.beginPath();
    this.magnifierCtx.moveTo(this.magnifierSize / 2, this.magnifierSize / 2 - 10);
    this.magnifierCtx.lineTo(this.magnifierSize / 2, this.magnifierSize / 2 + 10);
    this.magnifierCtx.moveTo(this.magnifierSize / 2 - 10, this.magnifierSize / 2);
    this.magnifierCtx.lineTo(this.magnifierSize / 2 + 10, this.magnifierSize / 2);
    this.magnifierCtx.stroke();
  }

  private updateHighlighter(mouseX: number, mouseY: number) {
    if (!this.highlighterCanvas || !this.highlighterCtx) return;

    // Calculate highlighter size based on size slider
    const highlighterSize = this.size * this.highlighterSizeMultiplier;

    // Clear previous highlighter
    this.highlighterCtx.clearRect(0, 0, this.highlighterCanvas.width, this.highlighterCanvas.height);

    // Draw spotlight effect - darken everything except the highlighted area
    this.highlighterCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.highlighterCtx.fillRect(0, 0, this.highlighterCanvas.width, this.highlighterCanvas.height);

    // Create circular cutout for the highlight
    this.highlighterCtx.globalCompositeOperation = 'destination-out';
    this.highlighterCtx.beginPath();
    this.highlighterCtx.arc(mouseX, mouseY, highlighterSize, 0, Math.PI * 2);
    this.highlighterCtx.fillStyle = 'rgba(0, 0, 0, 1)';
    this.highlighterCtx.fill();

    // Draw glowing ring around the highlight
    this.highlighterCtx.globalCompositeOperation = 'source-over';
    this.highlighterCtx.beginPath();
    this.highlighterCtx.arc(mouseX, mouseY, highlighterSize, 0, Math.PI * 2);
    this.highlighterCtx.strokeStyle = this.color;
    this.highlighterCtx.lineWidth = 3;
    this.highlighterCtx.shadowBlur = 15;
    this.highlighterCtx.shadowColor = this.color;
    this.highlighterCtx.stroke();

    // Reset shadow
    this.highlighterCtx.shadowBlur = 0;
  }

  private updateLaserPointer(mouseX: number, mouseY: number) {
    // Add new point to trail
    this.laserTrail.push({ x: mouseX, y: mouseY, age: 0 });

    // Remove old points
    if (this.laserTrail.length > this.maxTrailLength) {
      this.laserTrail.shift();
    }
  }

  private animateLaserPointer() {
    if (!this.laserPointerCtx || !this.laserPointerCanvas) return;

    // Clear canvas
    this.laserPointerCtx.clearRect(0, 0, this.laserPointerCanvas.width, this.laserPointerCanvas.height);

    // Draw trail
    if (this.currentTool === 'laserPointer' && this.laserTrail.length > 0) {
      // Convert hex color to RGB
      const rgb = this.hexToRgb(this.color);

      // Calculate laser pointer size based on size slider
      const laserPointerSize = this.size * this.laserPointerSizeMultiplier;

      for (let i = 0; i < this.laserTrail.length; i++) {
        const point = this.laserTrail[i];
        const opacity = (i + 1) / this.laserTrail.length;
        const size = (laserPointerSize * opacity) / 2;

        // Draw glow effect
        this.laserPointerCtx.beginPath();
        this.laserPointerCtx.arc(point.x, point.y, size + 5, 0, Math.PI * 2);
        this.laserPointerCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.3})`;
        this.laserPointerCtx.fill();

        // Draw main pointer
        this.laserPointerCtx.beginPath();
        this.laserPointerCtx.arc(point.x, point.y, size, 0, Math.PI * 2);
        this.laserPointerCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
        this.laserPointerCtx.fill();

        // Draw bright center (lighter version of the color)
        if (i === this.laserTrail.length - 1) {
          this.laserPointerCtx.beginPath();
          this.laserPointerCtx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
          const brightR = Math.min(255, rgb.r + 100);
          const brightG = Math.min(255, rgb.g + 100);
          const brightB = Math.min(255, rgb.b + 100);
          this.laserPointerCtx.fillStyle = `rgba(${brightR}, ${brightG}, ${brightB}, 1)`;
          this.laserPointerCtx.fill();
        }
      }
    }

    // Continue animation loop
    requestAnimationFrame(() => this.animateLaserPointer());
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
  }

  private toggleKeyDisplay() {
    this.isKeyDisplayEnabled = !this.isKeyDisplayEnabled;

    // Toggle button visual state
    const keyDisplayBtn = document.getElementById('keyDisplayBtn')!;
    if (this.isKeyDisplayEnabled) {
      keyDisplayBtn.classList.add('active');
    } else {
      keyDisplayBtn.classList.remove('active');
      // Clear all displayed keys
      this.activeKeys.forEach(keyDiv => keyDiv.remove());
      this.activeKeys.clear();
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.isKeyDisplayEnabled) return;
    if (this.isEditingText) return; // Don't show keys while editing text

    // Ignore if key is already being displayed
    if (this.activeKeys.has(e.code)) return;

    // Get friendly key name
    const keyName = this.getFriendlyKeyName(e);

    // Create key display element
    const keyDiv = document.createElement('div');
    keyDiv.className = 'key-display';
    keyDiv.textContent = keyName;
    keyDiv.style.cssText = `
      background: rgba(40, 40, 40, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      border: 2px solid rgba(66, 135, 245, 0.8);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      animation: keyPop 0.2s ease-out;
    `;

    this.activeKeys.set(e.code, keyDiv);
    this.keyDisplayContainer?.appendChild(keyDiv);

    // Auto-remove after 2 seconds if key is held
    setTimeout(() => {
      if (this.activeKeys.has(e.code)) {
        const div = this.activeKeys.get(e.code);
        if (div) {
          div.style.opacity = '0.5';
        }
      }
    }, 2000);
  }

  private handleKeyUp(e: KeyboardEvent) {
    if (!this.isKeyDisplayEnabled) return;

    const keyDiv = this.activeKeys.get(e.code);
    if (keyDiv) {
      // Fade out animation
      keyDiv.style.transition = 'opacity 0.3s, transform 0.3s';
      keyDiv.style.opacity = '0';
      keyDiv.style.transform = 'scale(0.8)';

      setTimeout(() => {
        keyDiv.remove();
        this.activeKeys.delete(e.code);
      }, 300);
    }
  }

  private getFriendlyKeyName(e: KeyboardEvent): string {
    // Special keys
    const specialKeys: { [key: string]: string } = {
      'Space': 'Space',
      'Enter': 'Enter',
      'Backspace': 'Backspace',
      'Tab': 'Tab',
      'Escape': 'Esc',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'ShiftLeft': 'Shift',
      'ShiftRight': 'Shift',
      'ControlLeft': 'Ctrl',
      'ControlRight': 'Ctrl',
      'AltLeft': 'Alt',
      'AltRight': 'Alt',
      'MetaLeft': 'Cmd',
      'MetaRight': 'Cmd',
      'CapsLock': 'Caps Lock',
      'Delete': 'Del',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PgUp',
      'PageDown': 'PgDn'
    };

    if (specialKeys[e.code]) {
      return specialKeys[e.code];
    }

    // For letter and number keys, use the key value
    if (e.key.length === 1) {
      return e.key.toUpperCase();
    }

    // Function keys
    if (e.code.startsWith('F') && e.code.length <= 3) {
      return e.code;
    }

    // Fallback to code
    return e.code.replace('Key', '').replace('Digit', '');
  }

  private togglePassThrough() {
    this.isPassThroughEnabled = !this.isPassThroughEnabled;

    // Toggle button visual state
    const passThroughBtn = document.getElementById('passThroughBtn')!;
    if (this.isPassThroughEnabled) {
      passThroughBtn.classList.add('active');
    } else {
      passThroughBtn.classList.remove('active');
    }

    // Notify main process to toggle click-through
    const electronAPI = (window as any).electronAPI as ElectronAPI;
    if (electronAPI) {
      electronAPI.toggleClickThrough(this.isPassThroughEnabled);
    }
  }

  private async takeScreenshot() {
    try {
      // Hide highlighter overlay temporarily for clean screenshot
      const highlighterWasVisible = this.highlighterCanvas?.style.display === 'block';
      if (highlighterWasVisible && this.highlighterCanvas) {
        this.highlighterCanvas.style.display = 'none';
      }

      // Convert canvas to data URL
      const dataUrl = this.canvas.toDataURL('image/png');

      // Restore highlighter if it was visible
      if (highlighterWasVisible && this.highlighterCanvas) {
        this.highlighterCanvas.style.display = 'block';
      }

      // Send to main process to save
      const electronAPI = (window as any).electronAPI as ElectronAPI;
      if (electronAPI) {
        const result = await electronAPI.saveScreenshot(dataUrl);

        if (result.success) {
          console.log('Screenshot saved to:', result.filePath);
          // Visual feedback - briefly flash the screenshot button
          const screenshotBtn = document.getElementById('screenshotBtn')!;
          screenshotBtn.style.backgroundColor = 'rgba(52, 199, 89, 0.5)';
          setTimeout(() => {
            screenshotBtn.style.backgroundColor = '';
          }, 300);
        } else if (!result.canceled) {
          console.error('Failed to save screenshot:', result.error);
        }
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
    }
  }

  private openWhiteboard() {
    const electronAPI = (window as any).electronAPI as ElectronAPI;
    if (electronAPI && electronAPI.openWhiteboard) {
      electronAPI.openWhiteboard();
    }
  }

  private clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private quit() {
    // Close the window properly
    window.close();
  }

  // Whiteboard-specific methods
  private saveState() {
    // Remove any states after current step (for redo)
    this.history = this.history.slice(0, this.historyStep + 1);

    // Save current state
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.history.push(imageData);
    this.historyStep++;

    // Limit history to 50 states to prevent memory issues
    if (this.history.length > 50) {
      this.history.shift();
      this.historyStep--;
    }

    // Update undo/redo button states
    this.updateUndoRedoButtons();
  }

  private undo() {
    if (this.historyStep <= 0) return;

    this.historyStep--;
    const imageData = this.history[this.historyStep];
    this.ctx.putImageData(imageData, 0, 0);
    this.updateUndoRedoButtons();
  }

  private redo() {
    if (this.historyStep >= this.history.length - 1) return;

    this.historyStep++;
    const imageData = this.history[this.historyStep];
    this.ctx.putImageData(imageData, 0, 0);
    this.updateUndoRedoButtons();
  }

  private updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
    const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement;

    if (undoBtn) {
      undoBtn.disabled = this.historyStep <= 0;
    }
    if (redoBtn) {
      redoBtn.disabled = this.historyStep >= this.history.length - 1;
    }
  }

  private erase(x1: number, y1: number, x2: number, y2: number) {
    const prevComposite = this.ctx.globalCompositeOperation;
    this.ctx.globalCompositeOperation = 'destination-out';

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    this.ctx.lineWidth = this.size * 2;
    this.ctx.lineCap = 'round';
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    this.ctx.globalCompositeOperation = prevComposite;
  }

  private createTextInput(x: number, y: number) {
    // Finalize existing text input if any
    if (this.textInput) {
      this.finalizeTextInput();
    }

    // Create textarea element
    this.textInput = document.createElement('textarea');
    this.textInput.style.position = 'fixed';
    this.textInput.style.left = x + 'px';
    this.textInput.style.top = y + 'px';
    this.textInput.style.fontSize = this.fontSize + 'px';
    this.textInput.style.color = this.color;
    this.textInput.style.background = 'rgba(255, 255, 255, 0.9)';
    this.textInput.style.border = '2px solid ' + this.color;
    this.textInput.style.borderRadius = '4px';
    this.textInput.style.padding = '8px';
    this.textInput.style.zIndex = '9999';
    this.textInput.style.minWidth = '200px';
    this.textInput.style.minHeight = '40px';
    this.textInput.style.resize = 'both';
    this.textInput.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    document.body.appendChild(this.textInput);

    // Focus the text input
    setTimeout(() => {
      if (this.textInput) {
        this.textInput.focus();
        this.isEditingText = true;
      }
    }, 50);

    // Handle blur and Enter key
    setTimeout(() => {
      if (this.textInput) {
        this.textInput.addEventListener('blur', () => {
          setTimeout(() => this.finalizeTextInput(), 100);
        });

        this.textInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            this.finalizeTextInput();
          }
        });
      }
    }, 100);
  }

  private finalizeTextInput() {
    if (!this.textInput || !this.isEditingText) return;

    const text = this.textInput.value.trim();
    const x = parseFloat(this.textInput.style.left);
    const y = parseFloat(this.textInput.style.top);

    // Remove the text input element
    if (this.textInput.parentNode) {
      this.textInput.parentNode.removeChild(this.textInput);
    }
    this.textInput = null;
    this.isEditingText = false;

    // Draw the text on canvas if not empty
    if (text) {
      this.ctx.font = `${this.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      this.ctx.fillStyle = this.color;
      this.ctx.textBaseline = 'top';

      // Draw each line
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        this.ctx.fillText(line, x, y + (index * this.fontSize * 1.2));
      });

      // Create text object for dragging
      const textObject: DrawObject = {
        type: 'text',
        tool: 'text',
        color: this.color,
        size: this.size,
        text: text,
        fontSize: this.fontSize,
        x: x,
        y: y,
        bounds: this.calculateTextBounds(text, x, y, this.fontSize)
      };

      this.drawnObjects.push(textObject);

      // Save state for undo
      this.saveState();
    }
  }

  private changeBackground(bg: string) {
    this.currentBackground = bg;
    document.body.style.background = bg;
  }

  private changeGrid(grid: string) {
    this.currentGrid = grid;
    document.body.classList.remove('grid-dots', 'grid-lines');

    if (grid === 'dots') {
      document.body.classList.add('grid-dots');
    } else if (grid === 'lines') {
      document.body.classList.add('grid-lines');
    }
  }

  // Selection helper methods
  private clearSelection() {
    if (this.selectionRect && this.selectedImageData) {
      // Paste the selection back before clearing
      this.ctx.putImageData(this.selectedImageData, this.selectionRect.x, this.selectionRect.y);
    }
    this.selectedImageData = null;
    this.selectionRect = null;
    this.isDraggingSelection = false;
    this.isSelecting = false;
  }

  private isInsideSelection(x: number, y: number): boolean {
    if (!this.selectionRect) return false;
    return (
      x >= this.selectionRect.x &&
      x <= this.selectionRect.x + this.selectionRect.width &&
      y >= this.selectionRect.y &&
      y <= this.selectionRect.y + this.selectionRect.height
    );
  }

  private drawSelectionRect(x1: number, y1: number, x2: number, y2: number) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    // Draw blue dashed rectangle
    this.ctx.strokeStyle = '#4287f5';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
  }

  private finalizeSelection(x: number, y: number, width: number, height: number) {
    // Store selection rectangle
    this.selectionRect = { x, y, width, height };

    // Cut the selected area
    this.selectedImageData = this.ctx.getImageData(x, y, width, height);

    // Clear the selected area (make it transparent)
    this.ctx.clearRect(x, y, width, height);

    // Redraw with selection border
    this.drawSelectionRect(x, y, x + width, y + height);
  }

  private moveSelection(newX: number, newY: number) {
    if (!this.selectionRect || !this.selectedImageData || !this.savedImageData) return;

    // Restore canvas to clean state
    this.ctx.putImageData(this.savedImageData, 0, 0);

    // Update selection position
    this.selectionRect.x = newX;
    this.selectionRect.y = newY;

    // Draw image at new position
    this.ctx.putImageData(this.selectedImageData, newX, newY);

    // Draw selection border at new position
    this.drawSelectionRect(
      newX,
      newY,
      newX + this.selectionRect.width,
      newY + this.selectionRect.height
    );
  }

  private pasteSelection() {
    if (!this.selectionRect || !this.selectedImageData) return;

    // Paste the selection at current position
    this.ctx.putImageData(this.selectedImageData, this.selectionRect.x, this.selectionRect.y);

    // Clear selection
    this.selectedImageData = null;
    this.selectionRect = null;
  }

  // Object management methods for draggable items
  private redrawAllObjects() {
    // Redraw all stored objects
    for (const obj of this.drawnObjects) {
      this.drawObject(obj);
    }
  }

  private drawObject(obj: DrawObject) {
    if (obj.type === 'brush' && obj.points && obj.points.length > 0) {
      // Draw brush stroke
      this.ctx.strokeStyle = obj.color;
      this.ctx.lineWidth = obj.size;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(obj.points[0].x, obj.points[0].y);
      for (let i = 1; i < obj.points.length; i++) {
        this.ctx.lineTo(obj.points[i].x, obj.points[i].y);
      }
      this.ctx.stroke();

      // Draw initial dot if only one point
      if (obj.points.length === 1) {
        this.ctx.beginPath();
        this.ctx.arc(obj.points[0].x, obj.points[0].y, obj.size / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = obj.color;
        this.ctx.fill();
      }
    } else if (obj.type === 'shape' && obj.startX !== undefined && obj.startY !== undefined && obj.endX !== undefined && obj.endY !== undefined) {
      // Draw shape
      this.ctx.strokeStyle = obj.color;
      this.ctx.fillStyle = obj.color;
      this.ctx.lineWidth = obj.size;
      this.drawShape(obj.startX, obj.startY, obj.endX, obj.endY, obj.tool);
    } else if (obj.type === 'text' && obj.text && obj.x !== undefined && obj.y !== undefined && obj.fontSize) {
      // Draw text
      this.ctx.font = `${obj.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      this.ctx.fillStyle = obj.color;
      this.ctx.textBaseline = 'top';

      const lines = obj.text.split('\n');
      lines.forEach((line, index) => {
        this.ctx.fillText(line, obj.x!, obj.y! + (index * obj.fontSize! * 1.2));
      });
    }
  }

  private hitTestObject(x: number, y: number): DrawObject | null {
    // Check objects in reverse order (most recent first)
    for (let i = this.drawnObjects.length - 1; i >= 0; i--) {
      const obj = this.drawnObjects[i];
      if (obj.bounds) {
        // Add some padding for easier selection
        const padding = 10;
        if (
          x >= obj.bounds.x - padding &&
          x <= obj.bounds.x + obj.bounds.width + padding &&
          y >= obj.bounds.y - padding &&
          y <= obj.bounds.y + obj.bounds.height + padding
        ) {
          return obj;
        }
      }
    }
    return null;
  }

  private moveObject(obj: DrawObject, deltaX: number, deltaY: number) {
    if (obj.type === 'brush' && obj.points) {
      // Move all points
      for (const point of obj.points) {
        point.x += deltaX;
        point.y += deltaY;
      }
    } else if (obj.type === 'shape') {
      // Move shape endpoints
      if (obj.startX !== undefined) obj.startX += deltaX;
      if (obj.startY !== undefined) obj.startY += deltaY;
      if (obj.endX !== undefined) obj.endX += deltaX;
      if (obj.endY !== undefined) obj.endY += deltaY;
    } else if (obj.type === 'text') {
      // Move text position
      if (obj.x !== undefined) obj.x += deltaX;
      if (obj.y !== undefined) obj.y += deltaY;
    }

    // Update bounds
    if (obj.bounds) {
      obj.bounds.x += deltaX;
      obj.bounds.y += deltaY;
    }
  }

  private calculateStrokeBounds(points: Array<{ x: number; y: number }>, size: number): { x: number; y: number; width: number; height: number } {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    // Add padding for stroke width
    const padding = size / 2;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  }

  private calculateShapeBounds(startX: number, startY: number, endX: number, endY: number, tool: Tool): { x: number; y: number; width: number; height: number } {
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const maxX = Math.max(startX, endX);
    const maxY = Math.max(startY, endY);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private calculateTextBounds(text: string, x: number, y: number, fontSize: number): { x: number; y: number; width: number; height: number } {
    // Set font to measure text
    this.ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

    const lines = text.split('\n');
    let maxWidth = 0;

    // Find the longest line
    for (const line of lines) {
      const metrics = this.ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    }

    const height = lines.length * fontSize * 1.2;

    return {
      x: x,
      y: y,
      width: maxWidth,
      height: height
    };
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ScreenAnnotationApp();
  });
} else {
  new ScreenAnnotationApp();
}
