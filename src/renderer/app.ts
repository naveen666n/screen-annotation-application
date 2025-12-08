type Tool = 'brush' | 'magnifier' | 'highlighter' | 'arrow' | 'rectangle' | 'circle' | 'line' | 'roundRect' | 'star';

interface ElectronAPI {
  toggleClickThrough: (enabled: boolean) => void;
  setMouseOverToolbar: (isOver: boolean) => void;
  saveScreenshot: (dataUrl: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
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
  private highlighterSize = 100;

  // Shape drawing properties
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;
  private savedImageData: ImageData | null = null;

  // Click-through mode
  private isPassThroughEnabled = false;

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupCanvas();
    this.setupEventListeners();
    this.setupMagnifier();
    this.setupHighlighter();
    this.setupTempCanvas();
    this.setupToolbarDragging();

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

  private setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Tool buttons
    const brushBtn = document.getElementById('brushBtn')!;
    const magnifierBtn = document.getElementById('magnifierBtn')!;
    const highlighterBtn = document.getElementById('highlighterBtn')!;
    const shapesBtn = document.getElementById('shapesBtn')!;
    const shapesDropdown = document.getElementById('shapesDropdown')!;

    brushBtn.addEventListener('click', () => this.selectTool('brush'));
    magnifierBtn.addEventListener('click', () => this.selectTool('magnifier'));
    highlighterBtn.addEventListener('click', () => this.selectTool('highlighter'));

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

    // Controls
    const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
    const sizeSlider = document.getElementById('sizeSlider') as HTMLInputElement;
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
    passThroughBtn.addEventListener('click', () => this.togglePassThrough());
    screenshotBtn.addEventListener('click', () => this.takeScreenshot());
    clearBtn.addEventListener('click', () => this.clear());
    quitBtn.addEventListener('click', () => this.quit());

    // Track mouse over toolbar for pass-through mode
    const toolbar = document.getElementById('toolbar')!;
    const electronAPI = (window as any).electronAPI as ElectronAPI;

    toolbar.addEventListener('mouseenter', () => {
      if (electronAPI) {
        electronAPI.setMouseOverToolbar(true);
      }
    });

    toolbar.addEventListener('mouseleave', () => {
      if (electronAPI) {
        electronAPI.setMouseOverToolbar(false);
      }
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
    } else if (tool === 'magnifier') {
      document.getElementById('magnifierBtn')?.classList.add('active');
    } else if (tool === 'highlighter') {
      document.getElementById('highlighterBtn')?.classList.add('active');
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

    // Set appropriate cursor
    if (shapeTools.includes(tool)) {
      this.canvas.style.cursor = 'crosshair';
    } else if (tool === 'brush') {
      this.canvas.style.cursor = 'crosshair';
    } else if (tool === 'magnifier') {
      this.canvas.style.cursor = 'zoom-in';
    } else if (tool === 'highlighter') {
      this.canvas.style.cursor = 'none';
    }
  }

  private handleMouseDown(e: MouseEvent) {
    const shapeTools: Tool[] = ['arrow', 'rectangle', 'circle', 'line', 'roundRect', 'star'];

    if (this.currentTool === 'brush') {
      this.isDrawing = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      // Draw initial dot
      this.ctx.beginPath();
      this.ctx.arc(this.lastX, this.lastY, this.size / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = this.color;
      this.ctx.fill();
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

    if (this.currentTool === 'brush' && this.isDrawing) {
      this.drawLine(this.lastX, this.lastY, e.clientX, e.clientY);
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
    }
  }

  private handleMouseUp(e: MouseEvent) {
    const shapeTools: Tool[] = ['arrow', 'rectangle', 'circle', 'line', 'roundRect', 'star'];

    if (this.currentTool === 'brush') {
      this.isDrawing = false;
    } else if (shapeTools.includes(this.currentTool) && this.isDrawing) {
      // Finalize shape drawing
      this.isDrawing = false;
      this.savedImageData = null;

      // Draw final shape (already drawn in handleMouseMove, just clean up)
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

    // Clear previous highlighter
    this.highlighterCtx.clearRect(0, 0, this.highlighterCanvas.width, this.highlighterCanvas.height);

    // Draw spotlight effect - darken everything except the highlighted area
    this.highlighterCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.highlighterCtx.fillRect(0, 0, this.highlighterCanvas.width, this.highlighterCanvas.height);

    // Create circular cutout for the highlight
    this.highlighterCtx.globalCompositeOperation = 'destination-out';
    this.highlighterCtx.beginPath();
    this.highlighterCtx.arc(mouseX, mouseY, this.highlighterSize, 0, Math.PI * 2);
    this.highlighterCtx.fillStyle = 'rgba(0, 0, 0, 1)';
    this.highlighterCtx.fill();

    // Draw glowing ring around the highlight
    this.highlighterCtx.globalCompositeOperation = 'source-over';
    this.highlighterCtx.beginPath();
    this.highlighterCtx.arc(mouseX, mouseY, this.highlighterSize, 0, Math.PI * 2);
    this.highlighterCtx.strokeStyle = this.color;
    this.highlighterCtx.lineWidth = 3;
    this.highlighterCtx.shadowBlur = 15;
    this.highlighterCtx.shadowColor = this.color;
    this.highlighterCtx.stroke();

    // Reset shadow
    this.highlighterCtx.shadowBlur = 0;
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

  private clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private quit() {
    // Close the window properly
    window.close();
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
