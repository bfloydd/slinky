import { Notice, TFile } from 'obsidian';
import { BaseCommand } from './BaseCommand';
import { ResultItem } from '../types';

export class FindBacklinksWithMissingFileCommand extends BaseCommand {
    async execute(): Promise<void> {
        console.log('findBacklinksWithMissingFile');
        let missingFileCount = 0;
        const results: string[] = [];

        // Get all markdown files
        const markdownFiles = this.app.vault.getMarkdownFiles();

        for (const file of markdownFiles) {
            try {
                const content = await this.app.vault.read(file);
                const backlinks = this.extractBacklinks(content);

                for (const backlink of backlinks) {
                    // Skip if it's an attachment link
                    if (this.isAttachmentLink(backlink)) continue;

                    // Check if the markdown file exists
                    const exists = await this.markdownFileExistsInVault(backlink);
                    if (!exists) {
                        // Format the link using the same pattern as other commands
                        // Using the |path format that ResultsView expects for proper link rendering
                        const logMessage = `• [[${file.path}|${file.path}]] → [[${backlink}]]`;
                        console.log('Adding missing backlink:', logMessage);
                        results.push(logMessage);
                        missingFileCount++;
                    }
                }
            } catch (error) {
                console.error(`Error processing file '${file.path}':`, error);
            }
        }

        // Ensure there's always content to display
        if (results.length === 0) {
            results.push('No backlinks with missing files found.');
        }

        console.log('Final results for backlinks with missing files:', results);

        const resultItems: ResultItem[] = results.map(result => {
            // Skip the summary line if it exists
            if (result.startsWith('Summary:') || result === '\n---') {
                return null;
            }
            return {
                content: result,
                path: result.match(/\[\[(.*?)\|/)?.[1] ?? '',
                actions: [{
                    icon: 'file-search',
                    label: 'Reveal file in navigation',
                    onClick: async (path: string) => {
                        const file = this.app.vault.getAbstractFileByPath(path);
                        if (file instanceof TFile) {
                            const leaf = this.app.workspace.getLeaf();
                            await leaf.openFile(file);
                        }
                    }
                }]
            };
        }).filter((item): item is ResultItem => item !== null);

        // Add summary
        const summary = `\n---\nSummary: ${missingFileCount} ${missingFileCount === 1 ? 'backlink' : 'backlinks'} to non-existent files found`;
        
        await this.resultsView.setContent(summary, 'Backlinks With Missing Files', resultItems);
        new Notice(`Found ${missingFileCount} ${missingFileCount === 1 ? 'backlink' : 'backlinks'} to non-existent files`);
    }

    private extractBacklinks(content: string): string[] {
        const wikiLinkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
        const links: string[] = [];
        let match;

        while ((match = wikiLinkRegex.exec(content)) !== null) {
            if (match[1]) {
                // Remove any subpath references (#headers)
                const path = match[1].split('#')[0].trim();
                links.push(path);
            }
        }

        return links;
    }

    private isAttachmentLink(link: string): boolean {
        const attachmentExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'mp3', 'wav', 'pdf'];
        const extension = link.split('.').pop()?.toLowerCase();
        return extension ? attachmentExtensions.includes(extension) : false;
    }

    private async markdownFileExistsInVault(filename: string): Promise<boolean> {
        // Add .md extension if not present
        const mdFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
        const allFiles = this.app.vault.getMarkdownFiles();
        return allFiles.some(file =>
            file.path === mdFilename || // Exact path match
            file.basename === filename  // Basename match (without extension)
        );
    }
}