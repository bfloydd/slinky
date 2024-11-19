import { Plugin } from 'obsidian';
import { FindMissingAttachmentsCommand } from './src/commands/FindMissingAttachmentsCommand';
import { FindUnusedAttachmentsCommand } from './src/commands/FindUnusedAttachmentsCommand';
import { ResultsView, VIEW_TYPE_RESULTS } from './src/views/ResultsView';
import { LinkSpySettingTab } from './src/settings/SettingsTab';

interface LinkSpySettings {
	mySetting: string;
	attachmentFolderPath: string;
	moveToFolderPath: string;
	ignoreMoveToFolder: boolean;
}

const DEFAULT_SETTINGS: LinkSpySettings = {
	mySetting: 'default',
	attachmentFolderPath: '',
	moveToFolderPath: '',
	ignoreMoveToFolder: true,
}

export default class LinkSpy extends Plugin {
	settings: LinkSpySettings;
	private resultsView: ResultsView;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_RESULTS,
			(leaf) => (this.resultsView = new ResultsView(leaf))
		);

		this.addCommand({
			id: 'find-missing-attachments',
			name: 'Find missing attachments',
			callback: async () => {
				const view = await this.activateView();
				if (view) {
					const command = new FindMissingAttachmentsCommand(this.app, view);
					await command.execute();
				}
			}
		});

		this.addCommand({
			id: 'find-unused-attachments',
			name: 'Find unused attachments',
			callback: async () => {
				const view = await this.activateView();
				if (view) {
					const command = new FindUnusedAttachmentsCommand(this.app, view);
					await command.execute();
				}
			}
		});

		this.addSettingTab(new LinkSpySettingTab(this.app, this));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_RESULTS);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		const attachmentFolderPath = (this.app.vault as any).getConfig("attachmentFolderPath");
		if (attachmentFolderPath) {
			this.settings.attachmentFolderPath = attachmentFolderPath;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;
		
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_RESULTS)[0];
		
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return null;
			leaf = rightLeaf;
			await leaf.setViewState({
				type: VIEW_TYPE_RESULTS,
				active: true,
			});
		}
		
		workspace.revealLeaf(leaf);
		return this.resultsView;
	}
}
