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
        await this.resultsView.setContent(results.join('\n'), 'Unused Attachments');
        new Notice(`Found ${unusedAttachmentsCount} unused ${unusedAttachmentsCount === 1 ? 'attachment' : 'attachments'}`);
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
        const referencedImages = new Set<string>();
        
        for (const file of markdownFiles) {
            const content = await this.app.vault.read(file);
            const imageLinks = this.extractImageLinks(content);
            imageLinks.forEach(imageName => referencedImages.add(imageName));
        }
        
        return referencedImages;
    }

    protected extractImageLinks(content: string): string[] {
        const markdownImageRegex = /!\[.*?\]\((.*?)\)/g;
        const wikiImageRegex = /!\[\[(.*?)\]\]/g;
        
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
        
        // Extract wiki style links
        while ((match = wikiImageRegex.exec(content)) !== null) {
            if (match[1]) {
                const path = match[1].split('#')[0].split('|')[0].trim();
                const filename = path.split('/').pop();
                if (filename) {
                    links.push(filename);
                }
            }
        }
        
        return links;
    }
}
