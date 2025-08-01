// scripts/ui_components.js

class UIComponents {
  constructor() {
    this.dependencies = {};
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  createWindowComponent(title, contentElement, callbacks = {}) {
    const { onFocus, onClose } = callbacks;
    const { Utils } = this.dependencies;

    const titleSpan = Utils.createElement('span', { className: 'window-title', textContent: title });
    const closeBtn = this.createButton({ text: '×', classes: ['window-close-btn'], onClick: onClose });
    const header = Utils.createElement('header', { className: 'window-header' }, [titleSpan, closeBtn]);
    const content = Utils.createElement('div', { className: 'window-content' }, [contentElement]);
    const windowDiv = Utils.createElement('div', { className: 'app-window' }, [header, content]);

    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - windowDiv.offsetLeft;
      offsetY = e.clientY - windowDiv.offsetTop;
      if (onFocus) onFocus();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        windowDiv.style.left = `${e.clientX - offsetX}px`;
        windowDiv.style.top = `${e.clientY - offsetY}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    return windowDiv;
  }

  createAppWindow(title, onExit, options = {}) {
    const { Utils } = this.dependencies;

    const exitBtn = this.createButton({
      text: '×',
      title: 'Exit Application (Esc)',
      classes: ['app-header__exit-btn'],
      onClick: onExit
    });

    const header = Utils.createElement('header', { className: 'app-header' }, [
      Utils.createElement('h2', { className: 'app-header__title', textContent: title }),
      exitBtn
    ]);

    const main = Utils.createElement('main', { className: 'app-main' });
    const footer = Utils.createElement('footer', { className: 'app-footer' });

    const container = Utils.createElement('div', {
      id: `${title.toLowerCase().replace(/\s+/g, '-')}-app-container`,
      className: 'app-container'
    }, [header, main, footer]);

    return { container, header, main, footer };
  }

  createButton(options = {}) {
    const { Utils } = this.dependencies;
    const { text, onClick, classes = [], id = null, title = null, icon = null } = options;
    const btnClasses = ["btn", ...classes];

    const content = [];
    if (icon) {
      content.push(Utils.createElement('span', { className: 'btn-icon', textContent: icon }));
    }
    if (text) {
      content.push(document.createTextNode(text));
    }

    const attributes = {
      className: btnClasses.join(" "),
    };
    if (id) attributes.id = id;
    if (title) attributes.title = title;
    if (onClick) attributes.eventListeners = { click: onClick };

    return Utils.createElement("button", attributes, content);
  }
}