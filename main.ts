import { App, Notice, Plugin, PluginSettingTab, Setting, TFolder, WorkspaceLeaf, ItemView, TFile } from 'obsidian';

interface LinkSpySettings {
	mySetting: string;
	attachmentFolderPath: string;
}

const DEFAULT_SETTINGS: LinkSpySettings = {
	mySetting: 'default',
	attachmentFolderPath: ''
}

const VIEW_TYPE_RESULTS = "linkspy-results-view";

class ResultsView extends ItemView {
	private content: string = '';
	private title: string = 'LinkSpy';

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_RESULTS;
	}

	getDisplayText(): string {
		return "LinkSpy Results";
	}

	async setContent(content: string, title?: string) {
		this.content = content;
		if (title) {
			this.title = title;
		}
		await this.updateView();
	}

	async updateView() {
		const container = this.containerEl.children[1];
		container.empty();
		
		// Create separate containers for each title
		const mainTitleContainer = container.createDiv({
			cls: 'linkspy-main-title-container'
		});
		
		const subTitleContainer = container.createDiv({
			cls: 'linkspy-subtitle-container'
		});
		
		// Add main LinkSpy title and copy button in the same row
		const titleRow = mainTitleContainer.createDiv({
			cls: 'linkspy-title-row'
		});
		
		titleRow.createEl('h1', { 
			text: 'LinkSpy',
			cls: 'linkspy-main-title'
		});
		
		titleRow.createEl('button', {
			cls: 'linkspy-copy-button',
			text: 'Copy Results'
		});
		
		// Add specific results title on next line
		subTitleContainer.createEl('h2', { 
			text: this.title,
			cls: 'linkspy-results-title'
		});
		
		const contentDiv = container.createDiv({
			cls: 'linkspy-results-content'
		});

		if (this.content.includes('---')) {
			const lines = this.content.split('\n');
			
			lines.forEach(line => {
				if (line.startsWith('Summary:')) {
					const summaryEl = contentDiv.createEl('div', {
						cls: 'linkspy-results-summary'
					});
					summaryEl.createEl('strong', { text: line });

				} else if (line.includes('"') && !line.startsWith('---')) {
					const [filePath, ...rest] = line.substring(2).split('" line ');
					const lineEl = contentDiv.createDiv();
					lineEl.createSpan({ text: '• ' });
					
					const link = lineEl.createEl('a', {
						cls: 'internal-link',
						text: filePath
					});
					
					link.addEventListener('click', (event) => {
						event.preventDefault();
						const file = this.app.vault.getAbstractFileByPath(filePath.replace(/"/g, ''));
						if (file instanceof TFile) {
							this.app.workspace.getLeaf(false).openFile(file);
						}
					});
					
					const [lineNum, imageText] = rest[0].split(': ');
					lineEl.createSpan({ text: ` line ${lineNum}: ` });
					
					const italicMatch = imageText.match(/"<i>(.*?)<\/i>"/);
					if (italicMatch) {
						lineEl.createSpan({ text: '"' });
						lineEl.createEl('i', { text: italicMatch[1] });
						lineEl.createSpan({ text: '"' });
					}
				}
			});
		} else {
			this.content.split('\n').forEach(line => {
				const lineEl = contentDiv.createDiv();
				lineEl.innerHTML = line;
			});
		}
	}
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
			id: 'find-unused-attachments',
			name: 'Find unused attachments',
			callback: async () => {
				await this.findUnusedAttachments();
			}
		});
		
		this.addCommand({
			id: 'find-missing-attachments',
			name: 'Find missing attachments',
			callback: async () => {
				await this.findMissingAttachments();
			}
		});

	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_RESULTS);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// const attachmentFolderPath = this.app.vault.getConfig('attachmentFolderPath');
		const attachmentFolderPath = (this.app.vault as any).getConfig("attachmentFolderPath");
		// config.attachmentFolderPath;
		if (attachmentFolderPath) {
			this.settings.attachmentFolderPath = attachmentFolderPath;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private extractImageLinks(line: string): string[] {
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

	private async findMissingAttachments(): Promise<void> {
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

		const view = await this.activateView();
		if (view) {
			results.push('\n---');
			results.push(`Summary: ${missingAttachmentsCount} missing ${missingAttachmentsCount === 1 ? 'attachment' : 'attachments'} found`);
			await view.setContent(results.join('\n'), 'Missing Attachments');
			new Notice(`Found ${missingAttachmentsCount} missing ${missingAttachmentsCount === 1 ? 'attachment' : 'attachments'}`);
		}
	}

	private async imageExistsInVault(imageFile: string): Promise<boolean> {
		const allFiles = this.app.vault.getFiles();
		return allFiles.some(file => file.name === imageFile);
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

	private async findUnusedAttachments(): Promise<void> {
		console.log('findUnusedAttachments');
		const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
		const allFiles = this.app.vault.getFiles();
		
		// Get attachment folder configuration
		const attachmentFolderPath = (this.app.vault as any).getConfig("attachmentFolderPath");
		const useDefaultAttachmentFolder = (this.app.vault as any).getConfig("useMarkdownLinks");

		const attachmentFolders: string[] = [];
		if (attachmentFolderPath && useDefaultAttachmentFolder) {
			// Remove leading/trailing slashes and add to folders list
			attachmentFolders.push(attachmentFolderPath.replace(/^\/|\/$/g, ''));
		}

		const imageFiles = allFiles.filter(file => {
			const isImage = imageExtensions.some(ext => file.extension.toLowerCase() === ext);
			
			// If no attachment folder is specified, or if not using default folder, check all images
			if (!useDefaultAttachmentFolder || attachmentFolders.length === 0) {
				return isImage;
			}
			
			// Otherwise, only check images in the specified attachment folder
			return isImage && attachmentFolders.some(folder => {
				const filePath = file.path.replace(/^\/|\/$/g, '');
				return filePath.startsWith(folder);
			});
		});

		console.log('--------------------------------');
		console.log("attachmentFolderPath: " + attachmentFolderPath);
		console.log("useDefaultAttachmentFolder: " + useDefaultAttachmentFolder);
		console.log("allFiles: " + allFiles.length);
		console.log("imageFiles: " + imageFiles.length);
		console.log('--------------------------------');


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

		const view = await this.activateView();
		if (view) {
			results.push('\n---');
			results.push(`Summary: ${unusedAttachmentsCount} unused ${unusedAttachmentsCount === 1 ? 'attachment' : 'attachments'} found`);
			await view.setContent(results.join('\n'), 'Unused Attachments');
			new Notice(`Found ${unusedAttachmentsCount} unused ${unusedAttachmentsCount === 1 ? 'attachment' : 'attachments'}`);
		}
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
