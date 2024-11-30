import { Notice, TFile } from 'obsidian';
import { BaseCommand } from './BaseCommand';

export class FindUnusedAttachmentsCommand extends BaseCommand {
    async execute(): Promise<void> {
        console.log('findUnusedAttachments');
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
        const allFiles = this.app.vault.getFiles();
        
        const attachmentFolderPath = (this.app.vault as any).getConfig("attachmentFolderPath");
        const useDefaultAttachmentFolder = (this.app.vault as any).getConfig("useMarkdownLinks");

        const imageFiles = this.getImageFiles(allFiles, imageExtensions, attachmentFolderPath, useDefaultAttachmentFolder);

        const referencedImages = await this.buildReferencedImagesSet();

        let unusedAttachmentsCount = 0;
        let results: string[] = [];

        for (const imageFile of imageFiles) {
            if (!referencedImages.has(imageFile.name)) {
                const logMessage = `• [[${imageFile.path}|${imageFile.path}]]`;
                console.log('Adding unused attachment:', logMessage);
                results.push(logMessage);
                unusedAttachmentsCount++;
            }
        }

        console.log('Final results for unused attachments:', results);
        results.push('\n---');
        results.push(`Summary: ${unusedAttachmentsCount} unused ${unusedAttachmentsCount === 1 ? 'attachment' : 'attachments'} found`);
        await this.display(results, 'Unused Attachments');
        new Notice(`Found ${unusedAttachmentsCount} unused ${unusedAttachmentsCount === 1 ? 'attachment' : 'attachments'}`);
    }

    async display(results: string[], title: string) {
        // First, set the basic markdown content
        await this.resultsView.setContent(results.join('\n'), title);
        
        // Then add the interactive elements directly
        const container = this.resultsView.containerEl;
        
        // Reveal file handler
        container.querySelectorAll('.linkspy-icon[aria-label="Reveal file in navigation"]').forEach(icon => {
            icon.addEventListener('click', async (event) => {
                const path = (event.currentTarget as HTMLElement).dataset.path;
                if (path) {
                    const file = this.app.vault.getAbstractFileByPath(path);
                    if (file instanceof TFile) {
                        const leaf = this.app.workspace.getLeaf();
                        await leaf.openFile(file);
                    }
                }
            });
        });

        // Move to folder handler
        container.querySelectorAll('.linkspy-icon[aria-label="Move to folder"]').forEach(icon => {
            icon.addEventListener('click', async (event) => {
                const path = (event.currentTarget as HTMLElement).dataset.path;
                if (path) {
                    const file = this.app.vault.getAbstractFileByPath(path);
                    if (file instanceof TFile) {
                        // Get the move to folder path from settings
                        const plugin = (this.app as any).plugins.plugins['linkspy'];
                        const moveToPath = plugin.settings.moveToFolderPath;
                        
                        if (moveToPath) {
                            try {
                                // Ensure the target folder exists
                                await this.app.vault.createFolder(moveToPath).catch(() => {});
                                
                                // Move the file
                                const newPath = `${moveToPath}/${file.name}`;
                                await this.app.fileManager.renameFile(file, newPath);
                                
                                // Remove the item from the results view
                                (event.currentTarget as HTMLElement).closest('.linkspy-result-item')?.remove();
                                
                                new Notice(`Moved ${file.name} to ${moveToPath}`);
                            } catch (error) {
                                new Notice(`Failed to move file: ${error}`);
                            }
                        } else {
                            new Notice('Please set a move to folder path in settings');
                        }
                    }
                }
            });
        });
    }

    private getImageFiles(allFiles: TFile[], imageExtensions: string[], attachmentFolderPath: string, useDefaultAttachmentFolder: boolean) {
        const attachmentFolders: string[] = [];
        if (attachmentFolderPath && useDefaultAttachmentFolder) {
            attachmentFolders.push(attachmentFolderPath.replace(/^\/|\/$/g, ''));
        }

        // Get the move to folder path and ignore setting
        const plugin = (this.app as any).plugins.plugins['linkspy'];
        const moveToPath = plugin.settings.moveToFolderPath;
        const ignoreMoveToFolder = plugin.settings.ignoreMoveToFolder;

        return allFiles.filter(file => {
            const isImage = imageExtensions.some(ext => file.extension.toLowerCase() === ext);
            
            // Skip files in the move to folder if ignore is enabled
            if (ignoreMoveToFolder && moveToPath && file.path.startsWith(moveToPath)) {
                return false;
            }

            if (!useDefaultAttachmentFolder || attachmentFolders.length === 0) {
                return isImage;
            }
            
            return isImage && attachmentFolders.some(folder => {
                const filePath = file.path.replace(/^\/|\/$/g, '');
                return filePath.startsWith(folder);
            });
        });
    }

    private async buildReferencedImagesSet(): Promise<Set<string>> {
        const markdownFiles = this.app.vault.getMarkdownFiles();
        const canvasFiles = this.app.vault.getFiles().filter(file => file.extension === 'canvas');
        const referencedImages = new Set<string>();
        
        // Process markdown files
        for (const file of markdownFiles) {
            const content = await this.app.vault.read(file);
            const imageLinks = this.extractImageLinks(content);
            imageLinks.forEach(imageName => referencedImages.add(imageName));
        }

        // Process canvas files
        for (const file of canvasFiles) {
            const content = await this.app.vault.read(file);
            try {
                const canvasData = JSON.parse(content);
                if (canvasData.nodes) {
                    canvasData.nodes.forEach((node: any) => {
                        // Check file property for direct file attachments
                        if (node.file) {
                            const filename = node.file.split('/').pop();
                            if (filename) referencedImages.add(filename);
                        }
                        
                        // Check text content in note nodes for markdown image references
                        if (node.type === 'text' && node.text) {
                            const imageLinks = this.extractImageLinks(node.text);
                            imageLinks.forEach(imageName => referencedImages.add(imageName));
                        }
                    });
                }
            } catch (e) {
                console.error('Error parsing canvas file:', e);
            }
        }
        
        return referencedImages;
    }

    protected extractImageLinks(content: string): string[] {
        const markdownImageRegex = /!\[.*?\]\((.*?)\)/g;  // Standard markdown
        const wikiImageRegex = /(?:!\[\[(.*?\.(jpg|jpeg|png|gif|bmp))(?:\|.*?)?\]\])|(?:\[\[(.*?\.(jpg|jpeg|png|gif|bmp))(?:\|.*?)?\]\])/gi;  // Both ![[]] and [[]] wiki-links
        
        const links: string[] = [];
        
        // Extract markdown style links
        let match;
        while ((match = markdownImageRegex.exec(content)) !== null) {
            if (match[1]) {
                const path = match[1].split('#')[0].split('|')[0].trim();
                const filename = path.split('/').pop();
                if (filename) {
                    links.push(filename);
                }
            }
        }
        
        // Extract both types of wiki style links
        while ((match = wikiImageRegex.exec(content)) !== null) {
            const fullPath = match[1] || match[3];  // match[1] for ![[]], match[3] for [[]]
            if (fullPath) {
                const path = fullPath.split('#')[0].split('|')[0].trim();
                const filename = path.split('/').pop();
                if (filename) {
                    links.push(filename);
                }
            }
        }
        
        return links;
    }
}
