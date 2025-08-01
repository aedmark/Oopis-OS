// scripts/apps/paint/paint_manager.js

window.PaintManager = class PaintManager extends App {
  constructor() {
    super();
    this.state = {};
    this.dependencies = {};
    this.callbacks = {};
    this.ui = null;
  }

  enter(appLayer, options = {}) {
    if (this.isActive) return;
    this.dependencies = options.dependencies;
    this.callbacks = this._createCallbacks();
    this.isWindowed = options.dependencies.isWindowed || false;

    this.state = this._createInitialState(
        options.dependencies.filePath,
        options.dependencies.fileContent
    );
    this.isActive = true;

    this.ui = new this.dependencies.PaintUI(this.state, this.callbacks, this.dependencies);
    this.container = this.ui.getContainer();
    
    if (this.isWindowed) {
      this.container.style.width = '100%';
      this.container.style.height = '100%';
      this.container.style.overflow = 'hidden';
    }
    
    appLayer.appendChild(this.container);
    this.container.focus();
  }

  exit() {
    if (!this.isActive) return;
    const { AppLayerManager, ModalManager } = this.dependencies;
    const performExit = () => {
      if (this.ui) {
        this.ui.hideAndReset();
      }
      if (AppLayerManager) {
        AppLayerManager.hide(this);
      }
      this.isActive = false;
      this.state = {};
      this.ui = null;
    };

    if (this.state.isDirty) {
      ModalManager.request({
        context: "graphical",
        messageLines: ["You have unsaved changes.", "Exit and discard them?"],
        confirmText: "Discard Changes",
        cancelText: "Cancel",
        onConfirm: performExit,
        onCancel: () => { },
      });
    } else {
      performExit();
    }
  }

  handleKeyDown(event) {
    if (!this.isActive) return;

    if (event.ctrlKey || event.metaKey) {
      let handled = true;
      switch (event.key.toLowerCase()) {
        case 's': this._saveContent(); break;
        case 'o': this.exit(); break;
        case 'z': event.shiftKey ? this.callbacks.onRedo() : this.callbacks.onUndo(); break;
        case 'y': this.callbacks.onRedo(); break;
        case 'x': this.callbacks.onCut(); break;
        case 'c': this.callbacks.onCopy(); break;
        case 'v': this.callbacks.onPaste(); break;
        default: handled = false;
      }
      if (handled) event.preventDefault();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.exit();
    }
  }

  _createInitialState(filePath, fileContent) {
    console.log('PaintManager: Creating initial state', { filePath, hasContent: !!fileContent, contentLength: fileContent?.length });
    
    const initialState = {
      isActive: true,
      isLocked: false,
      currentFilePath: filePath,
      canvasData: [],
      canvasDimensions: { width: 80, height: 24 },
      currentTool: "pencil",
      currentCharacter: "#",
      currentColor: "#FFFFFF",
      brushSize: 1,
      isDirty: false,
      gridVisible: false,
      isDrawing: false,
      startCoords: null,
      lastCoords: null,
      undoStack: [],
      redoStack: [],
      zoomLevel: 100,
      ZOOM_MIN: 50,
      ZOOM_MAX: 200,
      ZOOM_STEP: 10,
      selection: null,
      clipboard: null,
    };

    if (fileContent) {
      console.log('PaintManager: Processing file content:', fileContent.substring(0, 100));
      try {
        const parsed = JSON.parse(fileContent);
        console.log('PaintManager: Parsed content:', parsed);
        if (parsed.dimensions && parsed.cells) {
          initialState.canvasDimensions = parsed.dimensions;
          initialState.canvasData = parsed.cells;
          console.log('PaintManager: Loaded canvas data', { dimensions: parsed.dimensions, cellCount: parsed.cells.length });
        }
      } catch (e) {
        console.error("PaintManager: Error parsing .oopic file.", e);
      }
    } else {
      console.log('PaintManager: No file content, creating blank canvas');
    }

    if (initialState.canvasData.length === 0) {
      initialState.canvasData = this._getBlankCanvas(
          initialState.canvasDimensions
      );
    }

    initialState.undoStack.push(JSON.stringify(initialState.canvasData));
    return initialState;
  }

  _getBlankCanvas({ width, height }) {
    const canvas = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        row.push({ char: " ", color: "#000000" });
      }
      canvas.push(row);
    }
    return canvas;
  }

  _createCallbacks() {
    return {
      onToolSelect: (tool) => {
        if (this.state.isLocked) return;
        if (this.state.currentTool === "select" && tool !== "select") {
          this.state.selection = null;
          this.ui.hideSelectionRect();
        }
        this.state.currentTool = tool;
        this.ui.updateToolbar(this.state);
        this.ui.updateStatusBar(this.state);
      },
      onColorSelect: (color) => {
        this.state.currentColor = color;
        this.ui.updateToolbar(this.state);
      },
      onCharChange: (char) => {
        if (char.length > 0) this.state.currentCharacter = char.slice(0, 1);
        this.ui.updateStatusBar(this.state);
      },
      onBrushSizeChange: (newSize) => {
        this.state.brushSize = Math.max(1, Math.min(5, newSize || 1));
        this.ui.updateToolbar(this.state);
        this.ui.updateStatusBar(this.state);
      },
      onUndo: () => {
        if (this.state.undoStack.length <= 1) return;
        const currentCanvasState = this.state.undoStack.pop();
        this.state.redoStack.push(currentCanvasState);
        this.state.canvasData = JSON.parse(
            this.state.undoStack[this.state.undoStack.length - 1]
        );
        this.ui.renderCanvas(
            this.state.canvasData,
            this.state.canvasDimensions
        );
        this.state.isDirty = this.state.undoStack.length > 1;
        this.ui.updateToolbar(this.state);
      },
      onRedo: () => {
        if (this.state.redoStack.length === 0) return;
        const nextCanvasState = this.state.redoStack.pop();
        this.state.undoStack.push(nextCanvasState);
        this.state.canvasData = JSON.parse(nextCanvasState);
        this.ui.renderCanvas(
            this.state.canvasData,
            this.state.canvasDimensions
        );
        this.state.isDirty = true;
        this.ui.updateToolbar(this.state);
      },
      onToggleGrid: () => {
        this.state.gridVisible = !this.state.gridVisible;
        this.ui.toggleGrid(this.state.gridVisible);
      },
      onCanvasMouseDown: (coords) => {
        if (this.state.isLocked) return;
        this.state.isLocked = true;

        if (this.state.currentTool === "fill") {
          const char = this.state.currentCharacter;
          const color = this.state.currentColor;
          const fillCells = this._getCellsForFill(
              coords.x,
              coords.y,
              color,
              char
          );
          if (fillCells.length > 0) {
            this._applyCellsToData(fillCells);
            this.ui.updateCanvas(fillCells);
          }
          this.state.isLocked = false;
          return;
        }
        this.state.isDrawing = true;
        this.state.startCoords = coords;
        this.state.lastCoords = coords;
      },
      onCanvasMouseMove: (coords) => {
        this.state.lastCoords = coords;
        const char =
            this.state.currentTool === "eraser"
                ? " "
                : this.state.currentCharacter;
        const color =
            this.state.currentTool === "eraser"
                ? "#000000"
                : this.state.currentColor;
        let previewCells = [];

        if (this.state.isDrawing) {
          switch (this.state.currentTool) {
            case "select":
              const { x, y, width, height } = this._getSelectionRect(
                  this.state.startCoords,
                  coords
              );
              this.ui.showSelectionRect({ x, y, width, height });
              break;
            case "line":
              previewCells = this._getCellsForLine(
                  this.state.startCoords.x,
                  this.state.startCoords.y,
                  coords.x,
                  coords.y,
                  char,
                  color
              );
              break;
            case "rect":
              previewCells = this._getCellsForRect(
                  this.state.startCoords.x,
                  this.state.startCoords.y,
                  coords.x,
                  coords.y,
                  char,
                  color
              );
              break;
            case "circle":
              const rx = Math.abs(this.state.startCoords.x - coords.x);
              const ry = Math.abs(this.state.startCoords.y - coords.y);
              previewCells = this._getCellsForEllipse(
                  this.state.startCoords.x,
                  this.state.startCoords.y,
                  rx,
                  ry,
                  char,
                  color
              );
              break;
            case "pencil":
            case "eraser":
              const cells = this._getCellsForLine(
                  this.state.startCoords.x,
                  this.state.startCoords.y,
                  coords.x,
                  coords.y,
                  char,
                  color
              );
              this._applyCellsToData(cells);
              this.ui.updateCanvas(cells);
              this.state.startCoords = coords;
              break;
          }
        } else if (this.state.currentTool !== "select") {
          previewCells = this._getCellsInBrush(coords.x, coords.y, char, color);
        }

        this.ui.updatePreviewCanvas(previewCells);
        this.ui.updateStatusBar(this.state, coords);
      },
      onCanvasMouseUp: () => {
        if (!this.state.isDrawing) return;

        const endCoords = this.state.lastCoords;
        this.state.isDrawing = false;
        this.ui.updatePreviewCanvas([]);

        if (this.state.currentTool === "select" && this.state.startCoords) {
          this.state.selection = this._getSelectionRect(
              this.state.startCoords,
              endCoords
          );
        } else if (
            this.state.currentTool !== "select" &&
            this.state.startCoords &&
            endCoords
        ) {
          const char =
              this.state.currentTool === "eraser"
                  ? " "
                  : this.state.currentCharacter;
          const color =
              this.state.currentTool === "eraser"
                  ? "#000000"
                  : this.state.currentColor;
          let finalCells = [];

          switch (this.state.currentTool) {
            case "line":
              finalCells = this._getCellsForLine(
                  this.state.startCoords.x,
                  this.state.startCoords.y,
                  endCoords.x,
                  endCoords.y,
                  char,
                  color
              );
              break;
            case "rect":
              finalCells = this._getCellsForRect(
                  this.state.startCoords.x,
                  this.state.startCoords.y,
                  endCoords.x,
                  endCoords.y,
                  char,
                  color
              );
              break;
            case "circle":
              const rx = Math.abs(this.state.startCoords.x - endCoords.x);
              const ry = Math.abs(this.state.startCoords.y - endCoords.y);
              finalCells = this._getCellsForEllipse(
                  this.state.startCoords.x,
                  this.state.startCoords.y,
                  rx,
                  ry,
                  char,
                  color
              );
              break;
          }

          if (finalCells.length > 0) {
            this._applyCellsToData(finalCells);
            this.ui.updateCanvas(finalCells);
          }
        }

        this.state.startCoords = null;
        this.state.lastCoords = null;
        this.state.isLocked = false;
      },
      onCut: () => {
        if (!this.state.selection) return;
        this._copySelectionToClipboard();
        const { x, y, width, height } = this.state.selection;
        const erasedCells = [];
        for (let i = 0; i < height; i++) {
          for (let j = 0; j < width; j++) {
            erasedCells.push({
              x: x + j,
              y: y + i,
              char: " ",
              color: "#000000",
            });
          }
        }
        this._applyCellsToData(erasedCells);
        this.ui.updateCanvas(erasedCells);
        this.state.selection = null;
        this.ui.hideSelectionRect();
      },
      onCopy: () => {
        if (!this.state.selection) return;
        this._copySelectionToClipboard();
        this.state.selection = null;
        this.ui.hideSelectionRect();
      },
      onPaste: () => {
        if (!this.state.clipboard || !this.state.lastCoords) return;
        const pasteX = this.state.lastCoords.x;
        const pasteY = this.state.lastCoords.y;
        const pastedCells = [];
        for (let i = 0; i < this.state.clipboard.length; i++) {
          for (let j = 0; j < this.state.clipboard[i].length; j++) {
            pastedCells.push({
              x: pasteX + j,
              y: pasteY + i,
              ...this.state.clipboard[i][j],
            });
          }
        }
        this._applyCellsToData(pastedCells);
        this.ui.updateCanvas(pastedCells);
      },
      onSaveRequest: this._saveContent.bind(this),
      onExitRequest: this.exit.bind(this),
      onZoomIn: () => {
        this.state.zoomLevel = Math.min(
            this.state.ZOOM_MAX,
            this.state.zoomLevel + this.state.ZOOM_STEP
        );
        this.ui.updateZoom(this.state.zoomLevel);
        this.ui.updateStatusBar(this.state);
      },
      onZoomOut: () => {
        this.state.zoomLevel = Math.max(
            this.state.ZOOM_MIN,
            this.state.zoomLevel - this.state.ZOOM_STEP
        );
        this.ui.updateZoom(this.state.zoomLevel);
        this.ui.updateStatusBar(this.state);
      },
      onGetState: () => this.state,
      isGridVisible: () => this.state.gridVisible,
    };
  }

  _getSelectionRect(startCoords, endCoords) {
    const x = Math.min(startCoords.x, endCoords.x);
    const y = Math.min(startCoords.y, endCoords.y);
    const width = Math.abs(startCoords.x - endCoords.x) + 1;
    const height = Math.abs(startCoords.y - endCoords.y) + 1;
    return { x, y, width, height };
  }

  _copySelectionToClipboard() {
    if (!this.state.selection) return;
    const { x, y, width, height } = this.state.selection;
    const clipboardData = [];
    for (let i = 0; i < height; i++) {
      const row = [];
      for (let j = 0; j < width; j++) {
        row.push(this.state.canvasData[y + i][x + j]);
      }
      clipboardData.push(row);
    }
    this.state.clipboard = clipboardData;
  }

  _applyCellsToData(cells) {
    cells.forEach((cell) => {
      if (
          cell.y >= 0 &&
          cell.y < this.state.canvasDimensions.height &&
          cell.x >= 0 &&
          cell.x < this.state.canvasDimensions.width
      ) {
        this.state.canvasData[cell.y][cell.x] = {
          char: cell.char,
          color: cell.color,
        };
      }
    });
    this._pushToUndoStack();
  }

  _pushToUndoStack() {
    this.state.undoStack.push(JSON.stringify(this.state.canvasData));
    if (this.state.undoStack.length > 50) {
      this.state.undoStack.shift();
    }
    this.state.redoStack = [];
    this.state.isDirty = true;
    this.ui.updateToolbar(this.state);
  }

  async _saveContent() {
    if (!this.isActive) return;
    const { FileSystemManager, UserManager } = this.dependencies;

    const dataToSave = {
      format: "oopis-paint-v1",
      dimensions: this.state.canvasDimensions,
      cells: this.state.canvasData,
    };
    const jsonContent = JSON.stringify(dataToSave, null, 2);
    const currentUser = UserManager.getCurrentUser().name;
    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
    const saveResult = await FileSystemManager.createOrUpdateFile(
        this.state.currentFilePath,
        jsonContent,
        { currentUser, primaryGroup }
    );

    if (saveResult.success && (await FileSystemManager.save())) {
      this.state.isDirty = false;
    } else {
      this.ui.updateStatusBar({
        ...this.state,
        statusMessage: `Error: ${saveResult.error || "Failed to save to filesystem."}`,
      });
    }
    this.ui.updateToolbar(this.state);
  }
  _getCellsInBrush(x, y, char, color) {
    const affectedCells = [];
    const offset = Math.floor(this.state.brushSize / 2);
    for (let i = 0; i < this.state.brushSize; i++) {
      for (let j = 0; j < this.state.brushSize; j++) {
        const drawX = x + i - offset;
        const drawY = y + j - offset;
        if (
            drawY >= 0 &&
            drawY < this.state.canvasDimensions.height &&
            drawX >= 0 &&
            drawX < this.state.canvasDimensions.width
        ) {
          affectedCells.push({ x: drawX, y: drawY, char, color });
        }
      }
    }
    return affectedCells;
  }

  _getCellsForLine(x0, y0, x1, y1, char, color) {
    const affectedCells = [];
    const dx = Math.abs(x1 - x0),
        sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0),
        sy = y0 < y1 ? 1 : -1;
    let err = dx + dy,
        e2;

    for (; ;) {
      affectedCells.push(...this._getCellsInBrush(x0, y0, char, color));
      if (x0 === x1 && y0 === y1) break;
      e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return affectedCells;
  }

  _getCellsForRect(x0, y0, x1, y1, char, color) {
    let affectedCells = [];
    affectedCells.push(...this._getCellsForLine(x0, y0, x1, y0, char, color));
    affectedCells.push(...this._getCellsForLine(x0, y1, x1, y1, char, color));
    affectedCells.push(...this._getCellsForLine(x0, y0, x0, y1, char, color));
    affectedCells.push(...this._getCellsForLine(x1, y0, x1, y1, char, color));
    return affectedCells;
  }

  _getCellsForEllipse(xc, yc, rx, ry, char, color) {
    if (rx < 0 || ry < 0) return [];
    const allPoints = [];

    const plotPoints = (x, y) => {
      allPoints.push(...this._getCellsInBrush(xc + x, yc + y, char, color));
      allPoints.push(...this._getCellsInBrush(xc - x, yc + y, char, color));
      allPoints.push(...this._getCellsInBrush(xc + x, yc - y, char, color));
      allPoints.push(...this._getCellsInBrush(xc - x, yc - y, char, color));
    };

    let x = 0;
    let y = ry;
    let rx2 = rx * rx;
    let ry2 = ry * ry;
    let twoRx2 = 2 * rx2;
    let twoRy2 = 2 * ry2;
    let p;
    let px = 0;
    let py = twoRx2 * y;

    plotPoints(x, y);
    p = Math.round(ry2 - rx2 * ry + 0.25 * rx2);
    while (px < py) {
      x++;
      px += twoRy2;
      if (p < 0) {
        p += ry2 + px;
      } else {
        y--;
        py -= twoRx2;
        p += ry2 + px - py;
      }
      plotPoints(x, y);
    }

    p = Math.round(
        ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2
    );
    while (y > 0) {
      y--;
      py -= twoRx2;
      if (p > 0) {
        p += rx2 - py;
      } else {
        x++;
        px += twoRy2;
        p += rx2 - py + px;
      }
      plotPoints(x, y);
    }

    const uniqueCells = [];
    const seen = new Set();
    for (const cell of allPoints) {
      const key = `${cell.x},${cell.y}`;
      if (!seen.has(key)) {
        uniqueCells.push(cell);
        seen.add(key);
      }
    }
    return uniqueCells;
  }

  _getCellsForFill(startX, startY, fillColor, fillChar) {
    const { width, height } = this.state.canvasDimensions;
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
      return [];
    }

    const targetColor = this.state.canvasData[startY][startX].color;
    const targetChar = this.state.canvasData[startY][startX].char;

    if (targetColor === fillColor && targetChar === fillChar) {
      return [];
    }

    const affectedCells = [];
    const queue = [[startX, startY]];
    const visited = new Set([`${startX},${startY}`]);

    while (queue.length > 0) {
      const [x, y] = queue.shift();

      if (x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      const currentCell = this.state.canvasData[y][x];
      if (
          currentCell.color === targetColor &&
          currentCell.char === targetChar
      ) {
        affectedCells.push({ x, y, char: fillChar, color: fillColor });

        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        for (const [nx, ny] of neighbors) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            queue.push([nx, ny]);
            visited.add(key);
          }
        }
      }
    }
    return affectedCells;
  }
}
