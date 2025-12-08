class ScreenAnnotationApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private currentTool: 'brush' | 'magnifier' = 'brush';
  private color = '#ff0000';
  private size = 5;

  // Magnifier properties
  private magnifierCanvas: HTMLCanvasElement | null = null;
  private magnifierCtx: CanvasRenderingContext2D | null = null;
  private magnification = 2;
  private magnifierSize = 200;

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupCanvas();
    this.setupEventListeners();
    this.setupMagnifier();

    console.log('App initialized successfully');
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

  private setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Toolbar buttons
    const brushBtn = document.getElementById('brushBtn')!;
    const magnifierBtn = document.getElementById('magnifierBtn')!;
    const colorPicker = document.getElementById('colorPicker') as HTMLInputElement;
    const sizeSlider = document.getElementById('sizeSlider') as HTMLInputElement;
    const clearBtn = document.getElementById('clearBtn')!;
    const quitBtn = document.getElementById('quitBtn')!;

    brushBtn.addEventListener('click', () => this.selectTool('brush'));
    magnifierBtn.addEventListener('click', () => this.selectTool('magnifier'));
    colorPicker.addEventListener('input', (e) => {
      this.color = (e.target as HTMLInputElement).value;
    });
    sizeSlider.addEventListener('input', (e) => {
      this.size = parseInt((e.target as HTMLInputElement).value);
    });
    clearBtn.addEventListener('click', () => this.clear());
    quitBtn.addEventListener('click', () => this.quit());

    // Window resize
    window.addEventListener('resize', () => {
      this.setupCanvas();
    });
  }

  private selectTool(tool: 'brush' | 'magnifier') {
    this.currentTool = tool;

    // Update UI
    const brushBtn = document.getElementById('brushBtn')!;
    const magnifierBtn = document.getElementById('magnifierBtn')!;

    brushBtn.classList.toggle('active', tool === 'brush');
    magnifierBtn.classList.toggle('active', tool === 'magnifier');

    // Hide magnifier when switching to brush
    if (tool === 'brush' && this.magnifierCanvas) {
      this.magnifierCanvas.style.display = 'none';
    }

    // Change cursor
    this.canvas.style.cursor = tool === 'brush' ? 'crosshair' : 'zoom-in';
  }

  private handleMouseDown(e: MouseEvent) {
    if (this.currentTool === 'brush') {
      this.isDrawing = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      // Draw initial dot
      this.ctx.beginPath();
      this.ctx.arc(this.lastX, this.lastY, this.size / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = this.color;
      this.ctx.fill();
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.currentTool === 'brush' && this.isDrawing) {
      this.drawLine(this.lastX, this.lastY, e.clientX, e.clientY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    } else if (this.currentTool === 'magnifier') {
      this.updateMagnifier(e.clientX, e.clientY);
    }
  }

  private handleMouseUp() {
    if (this.currentTool === 'brush') {
      this.isDrawing = false;
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
