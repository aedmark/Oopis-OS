// scripts/apps/editor_commands.js

/**
 * @abstract
 * Represents an abstract command that can be executed and un-executed.
 */
class Command {
    /**
     * Executes the command.
     * @param {EditorManager} editorManager - The instance of the editor manager.
     */
    execute(editorManager) {
        throw new Error("Command.execute() must be implemented by subclasses.");
    }

    /**
     * Un-executes, or reverts, the command.
     * @param {EditorManager} editorManager - The instance of the editor manager.
     */
    unexecute(editorManager) {
        throw new Error("Command.unexecute() must be implemented by subclasses.");
    }
}

/**
 * Command to insert text at a specific position.
 */
class InsertTextCommand extends Command {
    constructor(text, position) {
        super();
        this.text = text;
        this.position = position;
    }

    execute(editorManager) {
        const currentContent = editorManager.getContent();
        const newContent = currentContent.slice(0, this.position) + this.text + currentContent.slice(this.position);
        editorManager.setContent(newContent);
        editorManager.setCursor(this.position + this.text.length);
    }

    unexecute(editorManager) {
        const currentContent = editorManager.getContent();
        const newContent = currentContent.slice(0, this.position) + currentContent.slice(this.position + this.text.length);
        editorManager.setContent(newContent);
        editorManager.setCursor(this.position);
    }
}

/**
 * Command to delete a range of text.
 */
class DeleteRangeCommand extends Command {
    constructor(start, end) {
        super();
        this.start = start;
        this.end = end;
        this.deletedText = '';
    }

    execute(editorManager) {
        const currentContent = editorManager.getContent();
        this.deletedText = currentContent.substring(this.start, this.end);
        const newContent = currentContent.slice(0, this.start) + currentContent.slice(this.end);
        editorManager.setContent(newContent);
        editorManager.setCursor(this.start);
    }

    unexecute(editorManager) {
        const currentContent = editorManager.getContent();
        const newContent = currentContent.slice(0, this.start) + this.deletedText + currentContent.slice(this.start);
        editorManager.setContent(newContent);
        editorManager.setCursor(this.start + this.deletedText.length);
    }
}

/**
 * Command for a "find and replace all" operation.
 */
class ReplaceAllCommand extends Command {
    constructor(findQuery, replaceText, originalContent) {
        super();
        this.findQuery = findQuery;
        this.replaceText = replaceText;
        this.originalContent = originalContent;
        this.newContent = null;
    }

    execute(editorManager) {
        if (this.newContent === null) {
            const regex = new RegExp(this.findQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            this.newContent = this.originalContent.replace(regex, this.replaceText);
        }
        editorManager.setContent(this.newContent);
    }

    unexecute(editorManager) {
        editorManager.setContent(this.originalContent);
    }
}