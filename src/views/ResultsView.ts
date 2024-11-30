import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { setIcon, TFolder } from 'obsidian';
import { MarkdownRenderer } from 'obsidian';

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

    async setContent(content: string, title?: string, postRender?: () => void) {
        this.content = content;
        if (title) {
            this.title = title;
        }
        await this.updateView();
        if (postRender) {
            postRender();
        }
    }

    async updateView() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // Create separate containers for each title
        const mainTitleContainer = container.createDiv({
            cls: 'linkspy-main-title-container'
        });
        
        const subTitleContainer = container.createDiv({
            cls: 'linkspy-subtitle-container'
        });
        
        // Add main LinkSpy title and copy button in the same row
        const titleRow = mainTitleContainer.createDiv({
            cls: 'linkspy-title-row'
        });
        
        titleRow.createEl('h1', { 
            text: 'LinkSpy',
            cls: 'linkspy-main-title'
        });
        
        titleRow.createEl('button', {
            cls: 'linkspy-copy-button',
            text: 'Copy Results'
        });
        
        // Add specific results title on next line
        subTitleContainer.createEl('h2', { 
            text: this.title,
            cls: 'linkspy-results-title'
        });

        // Display the content using MarkdownRenderer
        const contentContainer = container.createDiv({
            cls: 'linkspy-content-container'
        });

        await MarkdownRenderer.renderMarkdown(
            this.content,
            contentContainer,
            '',
            this
        );
    }
} 