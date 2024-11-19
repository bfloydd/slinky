import { App, PluginSettingTab, Setting } from 'obsidian';
import LinkSpy from '../../main';
import { TFolder } from 'obsidian';

function getFolderSuggestions(): string[] {
    const folders: string[] = ['/'];
    const folderList = this.app.vault.getAllLoadedFiles()
        .filter((f: any): f is TFolder => f instanceof TFolder)
        .map((folder: TFolder) => folder.path);
    return folders.concat(folderList);
}

export class LinkSpySettingTab extends PluginSettingTab {
    plugin: LinkSpy;

    constructor(app: App, plugin: LinkSpy) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h3', { text: 'Find Unused Attachments' });

        new Setting(containerEl)
            .setName('Move to folder')
            .setDesc('Select the folder where files will be moved to')
            .addDropdown(dropdown => {
                const folders = getFolderSuggestions();
                folders.forEach(folder => {
                    dropdown.addOption(folder, folder);
                });
                dropdown
                    .setValue(this.plugin.settings.moveToFolderPath)
                    .onChange(async (value) => {
                        this.plugin.settings.moveToFolderPath = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Ignore move to folder')
            .setDesc('When searching for unused attachments, ignore files in the move to folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ignoreMoveToFolder)
                .onChange(async (value) => {
                    this.plugin.settings.ignoreMoveToFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
} 