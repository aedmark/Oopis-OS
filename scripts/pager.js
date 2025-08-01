// scripts/pager.js

class PagerUI {
  constructor(dependencies) {
    this.elements = {};
    this.dependencies = dependencies;
  }

  buildLayout() {
    const { Utils } = this.dependencies;
    this.elements.content = Utils.createElement("div", {
      id: "pager-content",
      className: "p-2 whitespace-pre-wrap",
    });
    this.elements.statusBar = Utils.createElement("div", {
      id: "pager-status",
      className: "bg-gray-700 text-white p-1 text-center font-bold",
    });
    this.elements.container = Utils.createElement(
        "div",
        {
          id: "pager-container",
          className: "flex flex-col h-full w-full bg-black text-white font-mono",
        },
        [this.elements.content, this.elements.statusBar]
    );
    return this.elements.container;
  }

  render(lines, topVisibleLine, mode, terminalRows) {
    if (!this.elements.content || !this.elements.statusBar) return;

    const visibleLines = lines.slice(
        topVisibleLine,
        topVisibleLine + terminalRows
    );
    this.elements.content.innerHTML = visibleLines.join("<br>");

    const percent =
        lines.length > 0
            ? Math.min(
                100,
                Math.round(((topVisibleLine + terminalRows) / lines.length) * 100)
            )
            : 100;
    this.elements.statusBar.textContent = `-- ${mode.toUpperCase()} -- (${percent}%) (q to quit)`;
  }

  getTerminalRows() {
    const { Utils } = this.dependencies;
    if (!this.elements.content) return 24;
    const screenHeight = this.elements.content.clientHeight;
    const computedStyle = window.getComputedStyle(this.elements.content);
    const fontStyle = computedStyle.font;
    const { height: lineHeight } = Utils.getCharacterDimensions(fontStyle);
    if (lineHeight === 0) {
      return 24;
    }

    return Math.max(1, Math.floor(screenHeight / lineHeight));
  }

  reset() {
    this.elements = {};
  }
}

class PagerManager {
  constructor(dependencies) {
    this.dependencies = dependencies;
    this.ui = new PagerUI(dependencies);
    this.isActive = false;
    this.lines = [];
    this.topVisibleLine = 0;
    this.terminalRows = 24;
    this.mode = "more";
    this.exitCallback = null;
    this._boundHandleKeyDown = this._handleKeyDown.bind(this);
  }

  _handleKeyDown(e) {
    if (!this.isActive) return;

    e.preventDefault();
    let scrolled = false;

    switch (e.key) {
      case "q":
        this.exit();
        break;
      case " ":
      case "f":
        this.topVisibleLine = Math.min(
            this.topVisibleLine + this.terminalRows,
            Math.max(0, this.lines.length - this.terminalRows)
        );
        scrolled = true;
        break;
      case "ArrowDown":
        if (this.mode === "less") {
          this.topVisibleLine = Math.min(
              this.topVisibleLine + 1,
              Math.max(0, this.lines.length - this.terminalRows)
          );
          scrolled = true;
        }
        break;
      case "b":
      case "ArrowUp":
        if (this.mode === "less") {
          this.topVisibleLine = Math.max(0, this.topVisibleLine - this.terminalRows);
          scrolled = true;
        }
        break;
    }

    if (scrolled) {
      this.ui.render(this.lines, this.topVisibleLine, this.mode, this.terminalRows);
    }
  }

  enter(content, options) {
    if (this.isActive) return;
    this.isActive = true;

    this.lines = content.split("\n");
    this.topVisibleLine = 0;
    this.mode = options.mode || "more";

    const pagerElement = this.ui.buildLayout();
    this.dependencies.AppLayerManager.show(pagerElement);

    document.addEventListener("keydown", this._boundHandleKeyDown);

    setTimeout(() => {
      this.terminalRows = this.ui.getTerminalRows();
      this.ui.render(this.lines, this.topVisibleLine, this.mode, this.terminalRows);
    }, 0);

    return new Promise((resolve) => {
      this.exitCallback = resolve;
    });
  }

  exit() {
    if (!this.isActive) return;
    document.removeEventListener("keydown", this._boundHandleKeyDown);
    this.dependencies.AppLayerManager.hide();
    this.ui.reset();

    this.isActive = false;
    this.lines = [];
    this.topVisibleLine = 0;

    if (this.exitCallback) {
      this.exitCallback();
      this.exitCallback = null;
    }
  }
}