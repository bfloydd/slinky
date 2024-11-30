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
                    if (this.isAttachmentLink(backlink)) continue;

                    const exists = await this.markdownFileExistsInVault(backlink);
                    if (!exists) {
                        const displayName = file.basename;
                        const logMessage = `• [[${file.path}|${displayName}]] → ${backlink}`;
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
            
            // Extract the missing file name from the result string
            const missingFile = result.split('→ ')[1].trim();
            
            return {
                content: result,
                path: result.match(/\[\[(.*?)\|/)?.[1] ?? '',
                actions: [
                    {
                        icon: 'file-search',
                        label: 'Reveal file in navigation',
                        onClick: async (path: string) => {
                            const file = this.app.vault.getAbstractFileByPath(path);
                            if (file instanceof TFile) {
                                const leaf = this.app.workspace.getLeaf();
                                await leaf.openFile(file);
                            }
                        }
                    },
                    {
                        icon: 'file-plus',
                        label: 'Create missing file',
                        onClick: async (path: string) => {
                            try {
                                // Create the file
                                const newFile = await this.app.vault.create(
                                    missingFile.endsWith('.md') ? missingFile : `${missingFile}.md`,
                                    ''
                                );
                                
                                // Remove this item from the results
                                const updatedResults = resultItems.filter(item => 
                                    item && !item.content.includes(missingFile)
                                );
                                
                                // Update the count and summary
                                const newCount = updatedResults.length;
                                const summary = `\n---\nSummary: ${newCount} ${newCount === 1 ? 'backlink' : 'backlinks'} to non-existent files found`;
                                
                                // Update the view
                                await this.resultsView.setContent(summary, 'Backlinks With Missing Files', updatedResults);
                                
                                // Show success notice
                                new Notice(`Created file: ${missingFile}`);
                                
                                // Open the new file
                                const leaf = this.app.workspace.getLeaf();
                                await leaf.openFile(newFile);
                            } catch (error) {
                                new Notice(`Failed to create file: ${error}`);
                            }
                        }
                    }
                ]
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
        // Add .md or .canvas extension if not present
        const mdFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
        const canvasFilename = filename.endsWith('.canvas') ? filename : `${filename}.canvas`;
        
        const allFiles = this.app.vault.getFiles();
        return allFiles.some(file =>
            file.path === mdFilename || // Exact markdown path match
            file.path === canvasFilename || // Exact canvas path match
            file.basename === filename  // Basename match (without extension)
        );
    }
}