// scripts/apps/paint/paint_ui.js

window.PaintUI = class PaintUI {
  constructor(initialState, callbacks, dependencies) {
    this.elements = {};
    this.managerCallbacks = callbacks;
    this.dependencies = dependencies;
    this._globalMouseUpHandler = null;

    this._buildAndShow(initialState);
  }

  getContainer() {
    return this.elements.container;
  }

  _buildAndShow(initialState) {
    const { Utils, UIComponents } = this.dependencies;

    const isWindowed = this.dependencies.isWindowed;
    
    if (isWindowed) {
      this.elements.container = Utils.createElement('div', {
        id: 'oopis-paint-app-container',
        className: 'paint-windowed-container',
        style: 'width: 100%; height: 100%; display: flex; flex-direction: column;'
      });
      
      this.elements.header = Utils.createElement('div', {
        className: 'paint-toolbar',
        style: 'flex-shrink: 0;'
      });
      
      this.elements.main = Utils.createElement('div', {
        className: 'paint-main-content',
        style: 'flex: 1; overflow: hidden;'
      });
      
      this.elements.footer = Utils.createElement('div', {
        className: 'paint-statusbar',
        style: 'flex-shrink: 0;'
      });
      
      this.elements.container.append(this.elements.header, this.elements.main, this.elements.footer);
    } else {
      const appWindow = UIComponents.createAppWindow('Oopis Paint', this.managerCallbacks.onExitRequest);
      this.elements.container = appWindow.container;
      this.elements.header = appWindow.header;
      this.elements.main = appWindow.main;
      this.elements.footer = appWindow.footer;

      this.elements.container.id = 'oopis-paint-app-container';
    }

    const createToolBtn = (name, key, label) => UIComponents.createButton({
      id: `paint-tool-${name}`,
      text: label,
      title: `${name.charAt(0).toUpperCase() + name.slice(1)} (${key.toUpperCase()})`,
    });

    const toolGroup = Utils.createElement("div", { className: "paint-tool-group" }, [
      (this.elements.pencilBtn = createToolBtn("pencil", "p", "✏")),
      (this.elements.eraserBtn = createToolBtn("eraser", "e", "✐")),
      (this.elements.lineBtn = createToolBtn("line", "l", "▬")),
      (this.elements.rectBtn = createToolBtn("rect", "r", "▢")),
      (this.elements.circleBtn = createToolBtn("circle", "c", "◎")),
      (this.elements.fillBtn = createToolBtn("fill", "f", "▩")),
      (this.elements.selectBtn = createToolBtn("select", "s", "⬚")),
    ]);

    this.elements.colorPicker = Utils.createElement("input", {
      type: "color", id: "paint-color-picker", className: "paint-color-picker",
      title: "Select Color", value: initialState.currentColor
    });
    const colorGroup = Utils.createElement("div", { className: "paint-tool-group" }, [this.elements.colorPicker]);

    this.elements.brushSizeInput = Utils.createElement("input", { type: "number", className: "paint-brush-size", value: initialState.brushSize, min: 1, max: 5 });
    const brushGroup = Utils.createElement("div", { className: "paint-brush-controls" }, [this.elements.brushSizeInput]);

    this.elements.charInput = Utils.createElement("input", { type: "text", className: "paint-char-selector", value: initialState.currentCharacter, maxLength: 1 });

    this.elements.cutBtn = UIComponents.createButton({ text: "Cut", onClick: () => this.managerCallbacks.onCut() });
    this.elements.copyBtn = UIComponents.createButton({ text: "Copy", onClick: () => this.managerCallbacks.onCopy() });
    this.elements.pasteBtn = UIComponents.createButton({ text: "Paste", onClick: () => this.managerCallbacks.onPaste() });
    const editGroup = Utils.createElement("div", { className: "paint-tool-group" }, [this.elements.cutBtn, this.elements.copyBtn, this.elements.pasteBtn]);

    this.elements.undoBtn = UIComponents.createButton({ text: "↩" });
    this.elements.redoBtn = UIComponents.createButton({ text: "↪" });
    this.elements.gridBtn = UIComponents.createButton({ text: "▦" });
    const historyGroup = Utils.createElement("div", { className: "paint-tool-group" }, [this.elements.undoBtn, this.elements.redoBtn, this.elements.gridBtn]);

    this.elements.zoomInBtn = UIComponents.createButton({ text: "+" });
    this.elements.zoomOutBtn = UIComponents.createButton({ text: "-" });
    const zoomGroup = Utils.createElement("div", { className: "paint-tool-group" }, [this.elements.zoomOutBtn, this.elements.zoomInBtn]);

    if (!isWindowed) {
      const exitBtn = this.elements.header.querySelector('.app-header__exit-btn');
      this.elements.header.innerHTML = '';
      this.elements.header.append(toolGroup, colorGroup, brushGroup, this.elements.charInput, editGroup, historyGroup, zoomGroup, exitBtn);
    } else {
      this.elements.header.append(toolGroup, colorGroup, brushGroup, this.elements.charInput, editGroup, historyGroup, zoomGroup);
    }

    this.elements.canvas = Utils.createElement("div", { className: "paint-canvas", id: "paint-canvas" });
    this.elements.previewCanvas = Utils.createElement("div", { className: "paint-preview-canvas", id: "paint-preview-canvas" });
    this.elements.selectionRect = Utils.createElement("div", { className: "paint-selection-rect hidden" });
    const canvasContainer = Utils.createElement("div", { className: "paint-canvas-container" }, [this.elements.canvas, this.elements.previewCanvas, this.elements.selectionRect]);
    const mainDrawingArea = Utils.createElement("div", { className: "paint-main-drawing-area" }, [canvasContainer]);

    this.elements.main.appendChild(mainDrawingArea);

    this.elements.statusTool = Utils.createElement("span");
    this.elements.statusChar = Utils.createElement("span");
    this.elements.statusBrush = Utils.createElement("span");
    this.elements.statusCoords = Utils.createElement("span");
    this.elements.statusZoom = Utils.createElement("span");
    this.elements.footer.append(this.elements.statusTool, this.elements.statusChar, this.elements.statusBrush, this.elements.statusCoords, this.elements.statusZoom);

    this.renderInitialCanvas(initialState.canvasData, initialState.canvasDimensions);
    this.updateToolbar(initialState);
    this.updateStatusBar(initialState);
    this.updateZoom(initialState.zoomLevel);
    this._addEventListeners();
  }

  hideAndReset() {
    if (this._globalMouseUpHandler) {
      document.removeEventListener("mouseup", this._globalMouseUpHandler);
      this._globalMouseUpHandler = null;
    }

    if (this.elements.container) {
      this.elements.container.remove();
    }
    this.elements = {};
    this.managerCallbacks = {};
  }

  renderInitialCanvas(canvasData, dimensions) {
    if (!this.elements.canvas || !this.elements.previewCanvas) return;
    const { Utils } = this.dependencies;
    this.elements.canvas.innerHTML = "";
    this.elements.previewCanvas.innerHTML = "";

    this.elements.canvas.style.gridTemplateColumns = `repeat(${dimensions.width}, 1ch)`;
    this.elements.canvas.style.gridTemplateRows = `repeat(${dimensions.height}, 1em)`;
    this.elements.previewCanvas.style.gridTemplateColumns = `repeat(${dimensions.width}, 1ch)`;
    this.elements.previewCanvas.style.gridTemplateRows = `repeat(${dimensions.height}, 1em)`;

    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        const dataCell = canvasData[y]?.[x] || { char: " ", color: "#000000" };
        const cell = Utils.createElement("span", {
          id: `cell-${x}-${y}`,
          className: "paint-canvas-cell",
          textContent: dataCell.char,
          style: { color: dataCell.color },
        });
        this.elements.canvas.appendChild(cell);

        const previewCell = Utils.createElement("span", {
          id: `preview-cell-${x}-${y}`,
          className: "paint-canvas-cell",
        });
        this.elements.previewCanvas.appendChild(previewCell);
      }
    }
  }

  updateCanvas(cellsToUpdate) {
    cellsToUpdate.forEach((data) => {
      const cell = document.getElementById(`cell-${data.x}-${data.y}`);
      if (cell) {
        cell.textContent = data.char;
        cell.style.color = data.color;
      }
    });
  }

  updatePreviewCanvas(cellsToUpdate) {
    Array.from(this.elements.previewCanvas.children).forEach((child) => {
      if (child.textContent !== " ") {
        child.textContent = " ";
        child.style.color = "transparent";
      }
    });

    cellsToUpdate.forEach((data) => {
      const cell = document.getElementById(`preview-cell-${data.x}-${data.y}`);
      if (cell) {
        cell.textContent = data.char;
        cell.style.color = data.color;
      }
    });
  }

  updateToolbar(state) {
    if (!this.elements.pencilBtn) return;
    ["pencil", "eraser", "line", "rect", "circle", "fill", "select"].forEach(
        (tool) => {
          this.elements[`${tool}Btn`].classList.toggle(
              "active",
              state.currentTool === tool
          );
        }
    );
    this.elements.colorPicker.value = state.currentColor;
    this.elements.brushSizeInput.value = state.brushSize;
    this.elements.charInput.value = state.currentCharacter;
    this.elements.undoBtn.disabled = state.undoStack.length <= 1;
    this.elements.redoBtn.disabled = state.redoStack.length === 0;
  }

  updateStatusBar(state, coords = null) {
    if (!this.elements.statusTool) return;
    this.elements.statusTool.textContent = `Tool: ${state.currentTool}`;
    this.elements.statusChar.textContent = `Char: ${state.currentCharacter}`;
    this.elements.statusBrush.textContent = `Brush: ${state.brushSize}`;
    this.elements.statusCoords.textContent = coords
        ? `Coords: ${coords.x}, ${coords.y}`
        : "";
    this.elements.statusZoom.textContent = `Zoom: ${state.zoomLevel}%`;
  }

  toggleGrid(visible) {
    this.elements.canvas.classList.toggle("grid-visible", visible);
  }

  updateZoom(zoomLevel) {
    const baseFontSize = 20;
    const newSize = baseFontSize * (zoomLevel / 100);
    const gridShouldBeVisible =
        zoomLevel >= 70 && this.managerCallbacks.isGridVisible
            ? this.managerCallbacks.isGridVisible()
            : false;

    if (this.elements.canvas) {
      this.elements.canvas.style.fontSize = `${newSize}px`;
      this.elements.canvas.classList.toggle("grid-visible", gridShouldBeVisible);
    }
    if (this.elements.previewCanvas) {
      this.elements.previewCanvas.style.fontSize = `${newSize}px`;
    }
  }

  showSelectionRect(rect) {
    if (!this.elements.selectionRect || !this.elements.canvas.firstChild) return;
    const charWidth = this.elements.canvas.firstChild.offsetWidth;
    const charHeight = this.elements.canvas.firstChild.offsetHeight;

    this.elements.selectionRect.style.left = `${rect.x * charWidth}px`;
    this.elements.selectionRect.style.top = `${rect.y * charHeight}px`;
    this.elements.selectionRect.style.width = `${rect.width * charWidth}px`;
    this.elements.selectionRect.style.height = `${rect.height * charHeight}px`;
    this.elements.selectionRect.classList.remove("hidden");
  }

  hideSelectionRect() {
    if (this.elements.selectionRect) {
      this.elements.selectionRect.classList.add("hidden");
    }
  }

  _getCoordsFromEvent(e) {
    if (!this.elements.canvas || !this.elements.canvas.firstChild) return null;
    const rect = this.elements.canvas.getBoundingClientRect();
    const charWidth = this.elements.canvas.firstChild.offsetWidth;
    const charHeight = this.elements.canvas.firstChild.offsetHeight;
    if (charWidth === 0 || charHeight === 0) return null;
    const x = Math.floor((e.clientX - rect.left) / charWidth);
    const y = Math.floor((e.clientY - rect.top) / charHeight);
    return { x, y };
  }

  _addEventListeners() {
    this.elements.pencilBtn.addEventListener("click", () =>
        this.managerCallbacks.onToolSelect("pencil")
    );
    this.elements.eraserBtn.addEventListener("click", () =>
        this.managerCallbacks.onToolSelect("eraser")
    );
    this.elements.lineBtn.addEventListener("click", () =>
        this.managerCallbacks.onToolSelect("line")
    );
    this.elements.rectBtn.addEventListener("click", () =>
        this.managerCallbacks.onToolSelect("rect")
    );
    this.elements.circleBtn.addEventListener("click", () =>
        this.managerCallbacks.onToolSelect("circle")
    );
    this.elements.fillBtn.addEventListener("click", () =>
        this.managerCallbacks.onToolSelect("fill")
    );
    this.elements.selectBtn.addEventListener("click", () =>
        this.managerCallbacks.onToolSelect("select")
    );
    this.elements.colorPicker.addEventListener("input", (e) =>
        this.managerCallbacks.onColorSelect(e.target.value)
    );
    this.elements.brushSizeInput.addEventListener("change", () =>
        this.managerCallbacks.onBrushSizeChange(
            parseInt(this.elements.brushSizeInput.value, 10)
        )
    );
    this.elements.charInput.addEventListener("input", (e) =>
        this.managerCallbacks.onCharChange(e.target.value)
    );
    this.elements.undoBtn.addEventListener("click", () => this.managerCallbacks.onUndo());
    this.elements.redoBtn.addEventListener("click", () => this.managerCallbacks.onRedo());
    this.elements.gridBtn.addEventListener("click", () =>
        this.managerCallbacks.onToggleGrid()
    );
    this.elements.zoomInBtn.addEventListener("click", () =>
        this.managerCallbacks.onZoomIn()
    );
    this.elements.zoomOutBtn.addEventListener("click", () =>
        this.managerCallbacks.onZoomOut()
    );
    this.elements.canvas.addEventListener("mousedown", (e) => {
      const coords = this._getCoordsFromEvent(e);
      if (coords) this.managerCallbacks.onCanvasMouseDown(coords);
    });
    this.elements.canvas.addEventListener("mousemove", (e) => {
      const coords = this._getCoordsFromEvent(e);
      if (coords) this.managerCallbacks.onCanvasMouseMove(coords);
    });
    this._globalMouseUpHandler = () => this.managerCallbacks.onCanvasMouseUp();
    document.addEventListener("mouseup", this._globalMouseUpHandler);
    this.elements.canvas.addEventListener("mouseleave", () =>
        this.updateStatusBar(this.managerCallbacks.onGetState(), null)
    );
    this.elements.container.setAttribute("tabindex", "-1");
  }
}
