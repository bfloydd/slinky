import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { setIcon, TFolder } from 'obsidian';
import { MarkdownRenderer } from 'obsidian';
import { ResultItem } from '../types';

export const VIEW_TYPE_RESULTS = "linkspy-results-view";

export class ResultsView extends ItemView {
    private content: string = '';
    private title: string = 'LinkSpy';

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_RESULTS;
    }

    getDisplayText(): string {
        return "LinkSpy Results";
    }

    async setContent(content: string, title: string, resultItems: ResultItem[]) {
        this.content = content;
        this.title = title;
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
        
        // Add results title
        subTitleContainer.createEl('h2', { text: this.title, cls: 'linkspy-results-title' });

        // Create results container
        const resultsContainer = container.createDiv({ cls: 'linkspy-results-content' });

        // Render each result item
        for (const item of resultItems) {
            const resultLine = resultsContainer.createDiv({ cls: 'linkspy-result-line' });
            
            const lineContent = resultLine.createDiv({ cls: 'linkspy-line-content' });
            await MarkdownRenderer.render(this.app, item.content, lineContent, '', this);

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
            const summaryContent = this.content.split('---')[1];
            await MarkdownRenderer.render(this.app, summaryContent, summaryDiv, '', this);
        }
    }
} 