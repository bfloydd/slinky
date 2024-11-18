import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';

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

    async setContent(content: string, title?: string) {
        this.content = content;
        if (title) {
            this.title = title;
        }
        await this.updateView();
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
        
        const contentDiv = container.createDiv({
            cls: 'linkspy-results-content'
        });

        if (!this.content) {
            contentDiv.createEl('div', { text: 'No results to display' });
            return;
        }

        const lines = this.content?.split('\n') || [];
        lines.forEach(line => {
            if (!line) return;
            
            if (line.startsWith('Summary:')) {
                const summaryEl = contentDiv.createEl('div', {
                    cls: 'linkspy-results-summary'
                });
                summaryEl.createEl('strong', { text: line });
            } else if (line.startsWith('•')) {
                const lineEl = contentDiv.createDiv();
                
                if (line.includes('line')) {
                    // Handle Missing Attachments format (with line numbers)
                    const [pathPart, ...rest] = line.substring(2).split('line');
                    const filePath = pathPart.match(/\[\[(.*?)\|/)?.[1] || '';
                    
                    lineEl.createSpan({ text: '• ' });
                    
                    const link = lineEl.createEl('a', {
                        cls: 'internal-link',
                        text: filePath.replace(/[\[\]"]/g, '')
                    });
                    
                    link.addEventListener('click', (event) => {
                        event.preventDefault();
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        if (file instanceof TFile) {
                            this.app.workspace.getLeaf(false).openFile(file);
                        }
                    });
                    
                    lineEl.createSpan({ text: ' line' + rest.join('line') });
                } else {
                    // Handle Unused Attachments format (simple paths)
                    lineEl.innerHTML = line;
                }
            }
        });
    }
} 