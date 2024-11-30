import { Plugin, addIcon } from 'obsidian';
import { FindMissingAttachmentsCommand } from './src/commands/FindMissingAttachmentsCommand';
import { FindUnusedAttachmentsCommand } from './src/commands/FindUnusedAttachmentsCommand';
import { ResultsView, VIEW_TYPE_RESULTS } from './src/views/ResultsView';
import { LinkSpySettingTab } from './src/settings/SettingsTab';
import { FindBacklinksWithMissingFileCommand } from './src/commands/FindBacklinksWithMissingFileCommand';

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

		this.addCommand({
			id: 'find-backlinks-with-missing-file',
			name: 'Find backlinks with missing file',
			callback: async () => {
				const view = await this.activateView();
				if (view) {
					const command = new FindBacklinksWithMissingFileCommand(this.app, view);
					await command.execute();
				}
			}
		});

		this.addSettingTab(new LinkSpySettingTab(this.app, this));

		addIcon("brackets-with-eye", `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
		  <!-- Left [ with hook -->
		  <path d="M10 10v80h15"/>
		  <path d="M10 10h15"/>
		  
		  <!-- Eye (larger horizontal almond) -->
		  <path d="M25 50C25 35 40 30 50 30C60 30 75 35 75 50C75 65 60 70 50 70C40 70 25 65 25 50Z"/>
		  <circle cx="50" cy="50" r="8"/>
		  
		  <!-- Right ] with hook -->
		  <path d="M90 10v80h-15"/>
		  <path d="M90 10h-15"/>
		</svg>`);
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
