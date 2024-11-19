import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { setIcon, TFolder } from 'obsidian';

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
                const lineEl = contentDiv.createDiv({
                    cls: 'linkspy-result-line'
                });
                
                // Create a container for the line content and button
                const lineContentEl = lineEl.createDiv({
                    cls: 'linkspy-line-content'
                });

                // Extract filePath from the line
                const filePath = line.match(/\[\[(.*?)\|/)?.[1] || '';

                // Only create move button for unused attachments (lines without 'line' in them)
                if (!line.includes('line')) {
                    // Create a container for the buttons
                    const buttonsContainer = lineEl.createDiv({
                        cls: 'linkspy-buttons-container'
                    });
                    
                    // Add the search button
                    const searchButton = buttonsContainer.createEl('button', {
                        cls: 'clickable-icon'
                    });
                    setIcon(searchButton, 'search');

                    searchButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const fileName = filePath.split('/').pop() || '';
                        // Remove file extension and get base name
                        const baseFileName = fileName.replace(/\.[^/.]+$/, '');
                        // Open search with quoted filename (without extension)
                        (this.app as any).internalPlugins.getPluginById('global-search').instance.openGlobalSearch(`"${baseFileName}"`);
                        const searchLeaf = this.app.workspace.getLeavesOfType('search')[0];
                        if (searchLeaf) {
                            const searchView = searchLeaf.view as any;
                            searchView.searchComponent.setValue(`"${baseFileName}"`);
                        }
                    });
                    
                    // Add the move button with icon
                    const moveButton = buttonsContainer.createEl('button', {
                        cls: 'clickable-icon'
                    });
                    setIcon(moveButton, 'folder-input');

                    moveButton.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.handleMoveFile(filePath);
                    });
                }

                if (line.includes('line')) {
                    // Handle Missing Attachments format (with line numbers)
                    const [pathPart, ...rest] = line.substring(2).split('line');
                    const filePath = pathPart.match(/\[\[(.*?)\|/)?.[1] || '';
                    
                    lineContentEl.createSpan({ text: '• ' });
                    
                    const link = lineContentEl.createEl('a', {
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
                    
                    lineContentEl.createSpan({ text: ' line' });
                    
                    // Split the rest to separate the line number and image filename
                    const [lineNum, imageFile] = rest[0].split(':');
                    lineContentEl.createSpan({ text: lineNum + ': ' });
                    
                    // Create italicized image filename
                    lineContentEl.createEl('em', { 
                        text: imageFile.trim()
                    });
                } else {
                    // Handle Unused Attachments format
                    lineContentEl.createSpan({ text: '• ' });
                    
                    // Extract the file path from the wiki-link format
                    const filePath = line.match(/\[\[(.*?)\|/)?.[1] || '';
                    
                    const link = lineContentEl.createEl('a', {
                        cls: 'internal-link',
                        text: filePath
                    });
                    
                    link.addEventListener('click', (event) => {
                        event.preventDefault();
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        if (file instanceof TFile) {
                            this.app.workspace.getLeaf(false).openFile(file);
                        }
                    });
                }
            }
        });
    }

    private async handleMoveFile(filePath: string) {
        const plugin = (this.app as any).plugins.plugins['linkspy'];
        const moveToPath = plugin.settings.moveToFolderPath;

        if (!moveToPath) {
            new Notice('Please set a destination folder in LinkSpy settings first');
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(filePath);
        const targetFolder = this.app.vault.getAbstractFileByPath(moveToPath);

        if (!file) {
            new Notice('Source file not found');
            return;
        }

        if (!targetFolder || !(targetFolder instanceof TFolder)) {
            new Notice('Destination folder not found');
            return;
        }

        try {
            await this.app.fileManager.renameFile(
                file,
                `${moveToPath}/${file.name}`
            );
            
            // Remove the line from content and update view
            const lines = this.content.split('\n');
            const updatedLines = lines.filter(line => !line.includes(filePath));
            
            // Update the summary count
            const summaryLine = updatedLines[updatedLines.length - 1];
            if (summaryLine && summaryLine.startsWith('Summary:')) {
                const count = (summaryLine.match(/\d+/) || ['0'])[0];
                const newCount = parseInt(count) - 1;
                updatedLines[updatedLines.length - 1] = `Summary: ${newCount} unused ${newCount === 1 ? 'attachment' : 'attachments'} found`;
            }
            
            this.content = updatedLines.join('\n');
            await this.updateView();
            
            new Notice(`Moved ${file.name} to ${moveToPath}`);
        } catch (error) {
            new Notice(`Failed to move file: ${error}`);
        }
    }
} 