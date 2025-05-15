import { App, Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter } from "obsidian"
import * as fs from "fs"
import * as path from "path"

interface DocGenSettings {
	codebasePath: string
	supportedLanguages: string[]
}

const DEFAULT_SETTINGS: DocGenSettings = {
	codebasePath: "",
	supportedLanguages: ["js", "py"]
}

export default class DocGenPlugin extends Plugin {
	settings: DocGenSettings

	async onload() {
		console.log("Loading Automated Documentation Generator Plugin...")
		await this.loadSettings()
		this.addCommand({
			id: "generate-documentation",
			name: "Generate Documentation",
			callback: async () => {
				await this.generateDocumentation()
			}
		})
		this.addSettingTab(new DocGenSettingTab(this.app, this))
	}

	async onunload() {
		console.log("Unloading Automated Documentation Generator Plugin...")
	}

	async generateDocumentation() {
		const { codebasePath, supportedLanguages } = this.settings
		if (!codebasePath || !fs.existsSync(codebasePath)) {
			new Notice("Invalid codebase path. Please check your settings.")
			return
		}
		new Notice("Generating documentation...")
		const files = this.getFiles(codebasePath, supportedLanguages)
		files.forEach((file) => {
			const doc = this.parseFile(file)
			if (doc) {
				this.saveDocToVault(doc.fileName, doc.content)
			}
		})
		new Notice("Documentation generation complete!")
	}

	getFiles(dir: string, extensions: string[]): string[] {
		let results: string[] = []
		const files = fs.readdirSync(dir)
		for (const file of files) {
			const fullPath = path.join(dir, file)
			const stat = fs.statSync(fullPath)
			if (stat.isDirectory()) {
				results = results.concat(this.getFiles(fullPath, extensions))
			} else if (extensions.some((ext) => fullPath.endsWith(`.${ext}`))) {
				results.push(fullPath)
			}
		}
		return results
	}

	parseFile(filePath: string): { fileName: string; content: string } | null {
		const content = fs.readFileSync(filePath, "utf-8")
		const lines = content.split("\n")
		const comments: string[] = []
		lines.forEach((line) => {
			line = line.trim()
			if (line.startsWith("//") || line.startsWith("#")) {
				comments.push(line)
			}
		})
		if (comments.length === 0) {
			return null
		}
		const fileName = path.basename(filePath, path.extname(filePath))
		return {
			fileName,
			content: `# Documentation: ${fileName}\n\n${comments.join("\n")}`
		}
	}

	saveDocToVault(fileName: string, content: string) {
		let vaultPath = ""
		const adapter = this.app.vault.adapter
		if (adapter instanceof FileSystemAdapter) {
			vaultPath = adapter.getBasePath()
		} else {
			new Notice("Unable to get vault path: not a FileSystemAdapter.")
			return
		}
		const docPath = path.join(vaultPath, `${fileName}.md`)
		fs.writeFileSync(docPath, content)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}

class DocGenSettingTab extends PluginSettingTab {
	plugin: DocGenPlugin

	constructor(app: App, plugin: DocGenPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()
		containerEl.createEl("h2", { text: "Automated Documentation Generator Settings" })
		new Setting(containerEl)
			.setName("Codebase Path")
			.setDesc("Specify the path to your codebase.")
			.addText((text) =>
				text
					.setPlaceholder("e.g., /path/to/codebase")
					.setValue(this.plugin.settings.codebasePath)
					.onChange(async (value) => {
						this.plugin.settings.codebasePath = value
						await this.plugin.saveSettings()
					})
			)
		new Setting(containerEl)
			.setName("Supported File Extensions")
			.setDesc("Comma-separated list of supported file extensions (e.g., js, py).")
			.addText((text) =>
				text
					.setPlaceholder("e.g., js, py")
					.setValue(this.plugin.settings.supportedLanguages.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.supportedLanguages = value.split(",").map((x) => x.trim())
						await this.plugin.saveSettings()
					})
			)
	}
}
