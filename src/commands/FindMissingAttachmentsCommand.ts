import { Notice, TFile } from 'obsidian';
import { BaseCommand } from './BaseCommand';
import { ResultItem } from '../types';

export class FindMissingAttachmentsCommand extends BaseCommand {
    async execute(): Promise<void> {
        console.log('findMissingAttachments');
        let missingAttachmentsCount = 0;
        const files = this.app.vault.getMarkdownFiles();
        const results: ResultItem[] = [];

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
                            const content = `• [[${file.path}]] line ${index + 1}: ${imageFile}`;
                            results.push({
                                content,
                                path: file.path,
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
                            });
                            missingAttachmentsCount++;
                        }
                    });

                    checksForFile.push(...lineChecks);
                });

                await Promise.all(checksForFile);

            } catch (error) {
                console.error(`Error processing file '${file.path}':`, error);
            }
        }

        // Add summary
        const summary = `\n---\nSummary: ${missingAttachmentsCount} missing ${missingAttachmentsCount === 1 ? 'attachment' : 'attachments'} found`;
        
        await this.resultsView.setContent(summary, 'Missing Attachments', results);
        new Notice(`Found ${missingAttachmentsCount} missing ${missingAttachmentsCount === 1 ? 'attachment' : 'attachments'}`);
    }

    protected async imageExistsInVault(filename: string): Promise<boolean> {
        const allFiles = this.app.vault.getFiles();
        return allFiles.some(file => 
            file.path === filename || 
            file.name === filename || 
            file.basename === filename.split('.')[0]
        );
    }
} 