import { Notice } from 'obsidian';
import { BaseCommand } from './BaseCommand';

export class FindMissingAttachmentsCommand extends BaseCommand {
    async execute(): Promise<void> {
        console.log('findMissingAttachments');
        let missingAttachmentsCount = 0;
        const files = this.app.vault.getMarkdownFiles();
        let results: string[] = [];

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const lines = content.split('\n');
                const checksForFile: Promise<void>[] = [];

                lines.forEach((line, index) => {
                    const imageLinks = this.extractImageLinks(line);

                    const lineChecks = imageLinks.map(async (imageFile) => {
                        const exists = await this.imageExistsInVault(imageFile);
                        if (!exists) {
                            const logMessage = `• "${file.path}" line ${index + 1}: "<i>${imageFile}</i>"`;
                            results.push(logMessage);
                            missingAttachmentsCount++;
                        }
                    });

                    checksForFile.push(...lineChecks);
                });

                await Promise.all(checksForFile);

            } catch (error) {
                results.push(`Error processing file '${file.path}': ${error}`);
            }
        }

        results.push('\n---');
        results.push(`Summary: ${missingAttachmentsCount} missing ${missingAttachmentsCount === 1 ? 'attachment' : 'attachments'} found`);
        await this.resultsView.setContent(results.join('\n'), 'Missing Attachments');
        new Notice(`Found ${missingAttachmentsCount} missing ${missingAttachmentsCount === 1 ? 'attachment' : 'attachments'}`);
    }
} 