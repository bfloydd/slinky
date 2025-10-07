import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { setIcon, TFolder } from 'obsidian';
import { MarkdownRenderer } from 'obsidian';
import { ResultItem } from '../types';

export const VIEW_TYPE_RESULTS = "linkspy-results-view";

export class ResultsView extends ItemView {
    private content: string = '';
    private title: string = 'LinkSpy';
    private currentResultItems: ResultItem[] = [];
    private isUnusedAttachments: boolean = false;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_RESULTS;
    }

    getDisplayText(): string {
        return "LinkSpy Results";
    }

    getIcon(): string {
        return "brackets-with-eye";
    }

    async setContent(content: string, title: string, resultItems: ResultItem[]) {
        this.content = content;
        this.title = title;
        this.currentResultItems = resultItems;
        this.isUnusedAttachments = title === 'Unused Attachments';
        await this.updateView(resultItems);
    }

    async updateView(resultItems: ResultItem[]) {
        const container = this.containerEl.children[1];
        container.empty();
        
        // Create title containers
        const mainTitleContainer = container.createDiv({ cls: 'linkspy-main-title-container' });
        const subTitleContainer = container.createDiv({ cls: 'linkspy-subtitle-container' });
        
        // Add main title row
        const titleRow = mainTitleContainer.createDiv({ cls: 'linkspy-title-row' });
        titleRow.createEl('h1', { text: 'LinkSpy', cls: 'linkspy-main-title' });
        titleRow.createEl('button', { cls: 'linkspy-copy-button', text: 'Copy Results' });
        
        // Only show Move All button for unused attachments when files are found
        if (this.isUnusedAttachments && resultItems.length > 0) {
            const moveAllButton = titleRow.createEl('button', { cls: 'linkspy-move-all-button', text: 'Move All' });
            moveAllButton.addEventListener('click', () => this.moveAllItems());
        }
        
        // Add results title
        subTitleContainer.createEl('h2', { text: this.title, cls: 'linkspy-results-title' });

        // Create results container
        const resultsContainer = container.createDiv({ cls: 'linkspy-results-content' });

        // Render each result item
        for (const item of resultItems) {
            const resultLine = resultsContainer.createDiv({ cls: 'linkspy-result-line' });
            
            const lineContent = resultLine.createDiv({ cls: 'linkspy-line-content' });
            
            await MarkdownRenderer.render(this.app, item.content, lineContent, item.path, this);

            // Add click handler to the entire line
            lineContent.addEventListener('click', async () => {
                const file = this.app.vault.getAbstractFileByPath(item.path);
                if (file instanceof TFile) {
                    const leaf = this.app.workspace.getLeaf();
                    await leaf.openFile(file);
                }
            });

            // Make the line look clickable
            lineContent.addClass('linkspy-clickable');

            // Add action buttons
            if (item.actions.length > 0) {
                const buttonsContainer = resultLine.createDiv({ cls: 'linkspy-buttons-container' });
                
                for (const action of item.actions) {
                    const button = buttonsContainer.createDiv({
                        cls: 'linkspy-icon',
                        attr: { 'aria-label': action.label }
                    });
                    setIcon(button, action.icon);
                    
                    button.addEventListener('click', () => action.onClick(item.path));
                }
            }
        }

        // Render summary if present
        if (this.content.includes('---')) {
            const summaryDiv = resultsContainer.createDiv();
            let summaryContent = this.content.split('---')[1];
            summaryContent = '---' + summaryContent;
            await MarkdownRenderer.render(this.app, summaryContent, summaryDiv, '', this);
        }
    }

    async removeItemByPath(path: string): Promise<void> {
        // Remove the item from the current result items
        this.currentResultItems = this.currentResultItems.filter(item => item.path !== path);
        
        // Update the view with the filtered items
        await this.updateView(this.currentResultItems);
    }

    private async moveAllItems(): Promise<void> {
        const plugin = (this.app as any).plugins.plugins['slinky'];
        const moveToPath = plugin?.settings?.moveToFolderPath;
        
        if (!moveToPath) {
            new Notice('Please set a move to folder path in settings');
            return;
        }

        // Create the folder if it doesn't exist
        try {
            await this.app.vault.createFolder(moveToPath).catch(() => {});
        } catch (error) {
            new Notice(`Failed to create folder: ${error}`);
            return;
        }

        // Move all items
        const movedItems: string[] = [];
        const failedItems: string[] = [];

        for (const item of this.currentResultItems) {
            const file = this.app.vault.getAbstractFileByPath(item.path);
            if (file instanceof TFile) {
                try {
                    const newPath = `${moveToPath}/${file.name}`;
                    await this.app.fileManager.renameFile(file, newPath);
                    movedItems.push(file.name);
                } catch (error) {
                    failedItems.push(file.name);
                    console.error(`Failed to move ${file.name}:`, error);
                }
            }
        }

        // Show results
        if (movedItems.length > 0) {
            new Notice(`Moved ${movedItems.length} item(s) to ${moveToPath}`);
        }
        if (failedItems.length > 0) {
            new Notice(`Failed to move ${failedItems.length} item(s): ${failedItems.join(', ')}`);
        }

        // Clear the view since all items should be moved
        if (movedItems.length > 0) {
            this.currentResultItems = [];
            await this.updateView([]);
        }
    }
} 