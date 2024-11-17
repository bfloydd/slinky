import { App } from 'obsidian';
import { ResultsView } from '../../src/views/ResultsView';

export abstract class BaseCommand {
    constructor(
        protected app: App,
        protected resultsView: ResultsView
    ) {}

    abstract execute(): Promise<void>;

    protected extractImageLinks(line: string): string[] {
        const regex = /!?\[\[(.*?\.(jpg|jpeg|png|gif|bmp))(?:\|.*?)?\]\]/gi;
        const matches: string[] = [];
        let match;

        while ((match = regex.exec(line)) !== null) {
            const fullPath = match[1];
            const filename = fullPath.split('/').pop() || '';
            matches.push(filename);
        }
        return matches;
    }

    protected async imageExistsInVault(imageFile: string): Promise<boolean> {
        const allFiles = this.app.vault.getFiles();
        return allFiles.some(file => file.name === imageFile);
    }
} 