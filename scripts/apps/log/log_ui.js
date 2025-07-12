const LOG_DIR = "/home/Guest/.journal";

const LogUI = (() => {
    "use strict";
    let elements = {};
    let callbacks = {};

    function buildLayout(cb) {
        callbacks = cb;
        elements.entryList = Utils.createElement('div', { id: 'log-entry-list', className: 'log-app__list-pane' });

        elements.contentView = Utils.createElement('textarea', {
            id: 'log-content-view',
            className: 'log-app__content-pane log-app__content-pane--editable',
            placeholder: 'Select an entry to view or edit...'
        });

        elements.searchBar = Utils.createElement('input', { id: 'log-search-bar', type: 'text', placeholder: 'Search entries...', className: 'log-app__search' });
        elements.newBtn = Utils.createElement('button', { id: 'log-new-btn', textContent: 'New Entry', className: 'log-app__btn' });

        elements.saveBtn = Utils.createElement('button', { id: 'log-save-btn', textContent: 'Save Changes', className: 'log-app__btn hidden' });

        elements.exitBtn = Utils.createElement('button', { id: 'log-exit-btn', textContent: 'Exit', className: 'log-app__btn log-app__btn--exit' });

        elements.searchBar.addEventListener('input', () => callbacks.onSearch(elements.searchBar.value));
        elements.newBtn.addEventListener('click', () => callbacks.onNew());
        elements.saveBtn.addEventListener('click', () => callbacks.onSave());
        elements.exitBtn.addEventListener('click', () => callbacks.onExit());
        elements.contentView.addEventListener('input', () => callbacks.onContentChange());

        const header = Utils.createElement('header', { className: 'log-app__header' },
            Utils.createElement('h2', { textContent: 'Captain\'s Log' }),
            elements.searchBar,
            Utils.createElement('div', { className: 'log-app__actions'}, elements.newBtn, elements.saveBtn, elements.exitBtn)
        );

        const main = Utils.createElement('main', { className: 'log-app__main' }, elements.entryList, elements.contentView);
        elements.container = Utils.createElement('div', { id: 'log-app-container', className: 'log-app__container' }, header, main);

        return elements.container;
    }

    function renderEntries(entries, selectedPath) {
        elements.entryList.innerHTML = '';
        if (entries.length === 0) {
            elements.entryList.textContent = 'No entries found.';
            return;
        }
        entries.forEach((entry) => {
            const date = new Date(entry.timestamp);
            const title = entry.content.split('\n')[0].replace(/^#+\s*/, '').substring(0, 40) || '(Untitled)';
            const item = Utils.createElement('div', {
                className: 'log-app__list-item',
                'data-path': entry.path
            }, [
                Utils.createElement('strong', { textContent: date.toLocaleString() }),
                Utils.createElement('span', { textContent: title })
            ]);
            if (entry.path === selectedPath) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => callbacks.onSelect(entry.path));
            elements.entryList.appendChild(item);
        });
    }

    function renderContent(entry) {
        if (!entry) {
            elements.contentView.value = '';
            elements.contentView.placeholder = 'Select an entry to view or edit...';
            elements.saveBtn.classList.add('hidden');
            return;
        }
        elements.contentView.value = entry.content;
    }

    function updateSaveButton(isDirty) {
        elements.saveBtn.classList.toggle('hidden', !isDirty);
    }

    function getContent() {
        return elements.contentView.value;
    }

    function reset() {
        elements = {};
        callbacks = {};
    }

    return { buildLayout, renderEntries, renderContent, reset, getContent, updateSaveButton };
})();