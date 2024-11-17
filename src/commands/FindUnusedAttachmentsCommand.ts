import { Notice } from 'obsidian';
import { BaseCommand } from './BaseCommand';

export class FindUnusedAttachmentsCommand extends BaseCommand {
    async execute(): Promise<void> {
        console.log('findUnusedAttachments');
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
        const allFiles = this.app.vault.getFiles();
        
        const attachmentFolderPath = (this.app.vault as any).getConfig("attachmentFolderPath");
        const useDefaultAttachmentFolder = (this.app.vault as any).getConfig("useMarkdownLinks");

        const attachmentFolders: string[] = [];
        if (attachmentFolderPath && useDefaultAttachmentFolder) {
            attachmentFolders.push(attachmentFolderPath.replace(/^\/|\/$/g, ''));
        }

        const imageFiles = allFiles.filter(file => {
            const isImage = imageExtensions.some(ext => file.extension.toLowerCase() === ext);
            
            if (!useDefaultAttachmentFolder || attachmentFolders.length === 0) {
                return isImage;
            }
            
            return isImage && attachmentFolders.some(folder => {
                const filePath = file.path.replace(/^\/|\/$/g, '');
                return filePath.startsWith(folder);
            });
        });

        let unusedAttachmentsCount = 0;
        let results: string[] = [];

        for (const imageFile of imageFiles) {
            const isUsed = await this.isImageReferenced(imageFile.name);
            if (!isUsed) {
                const logMessage = `• "${imageFile.path}": "<i>Unused attachment</i>"`;
                results.push(logMessage);
                unusedAttachmentsCount++;
            }
        }

        results.push('\n---');
        results.push(`Summary: ${unusedAttachmentsCount} unused ${unusedAttachmentsCount === 1 ? 'attachment' : 'attachments'} found`);
        await this.resultsView.setContent(results.join('\n'), 'Unused Attachments');
        new Notice(`Found ${unusedAttachmentsCount} unused ${unusedAttachmentsCount === 1 ? 'attachment' : 'attachments'}`);
    }

    private async isImageReferenced(imageName: string): Promise<boolean> {
        const markdownFiles = this.app.vault.getMarkdownFiles();
        
        for (const file of markdownFiles) {
            const content = await this.app.vault.read(file);
            const imageLinks = this.extractImageLinks(content);
            if (imageLinks.includes(imageName)) {
                return true;
            }
        }
        
        return false;
    }
}
