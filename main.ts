import { App, Plugin, PluginSettingTab, Setting, Notice } from "obsidian"
import fetch from "node-fetch"

interface YouTrackSettings {
	youtrackApiToken: string
	youtrackHost: string
	noticeDuration: number
	errorNoticeDuration: number
}

const DEFAULT_SETTINGS: YouTrackSettings = {
	youtrackApiToken: "",
	youtrackHost: "",
	noticeDuration: 3000,
	errorNoticeDuration: 5000
}

export default class YouTrackIssuePlugin extends Plugin {
	settings: YouTrackSettings

	async onload() {
		console.log("Loading YouTrack Issue Plugin...")
		await this.loadSettings()

		await this.createSampleNote()

		this.addCommand({
			id: "fetch-youtrack-issues",
			name: "Fetch YouTrack Issue Details",
			callback: async () => {
				const file = this.app.workspace.getActiveFile()
				if (!file) {
					new Notice("No active file found.", this.settings.noticeDuration)
					return
				}
				let content = await this.app.vault.read(file)
				const lines = content.split("\n")
				const issueRegex = /#([A-Z]+-\d+)/g
				let match: RegExpExecArray | null
				let modified = false

				while ((match = issueRegex.exec(content)) !== null) {
					const issueId = match[1]
					const issueDetails = await this.fetchYouTrackIssueDetails(issueId)
					const message = `Processing issue: ${issueId} Details: ${issueDetails?.summary}`
					new Notice(message, this.settings.noticeDuration)
					if (issueDetails && issueDetails.summary) {
						const lineIndex = lines.findIndex(line => line.includes(match![0]))
						if (lineIndex !== -1) {
							const nextLine = lines[lineIndex + 1]
							if (!nextLine || !nextLine.includes("Title:")) {
								lines.splice(lineIndex + 1, 0, `Title: ${issueDetails.summary}`)
								modified = true
							}
						}
					}
				}

				if (modified) {
					const newContent = lines.join("\n")
					await this.app.vault.modify(file, newContent)
					new Notice("YouTrack issue details fetched and appended.", this.settings.noticeDuration)
				} else {
					new Notice("No YouTrack issues found to process.", this.settings.noticeDuration)
				}
			}
		})

		this.addSettingTab(new YouTrackSettingTab(this.app, this))
	}

	async onunload() {
		console.log("Unloading YouTrack Issue Plugin...")
	}

	async fetchYouTrackIssueDetails(issueId: string): Promise<{ summary: string } | null> {
		const apiToken = this.settings?.youtrackApiToken
		if (!apiToken) {
			new Notice("YouTrack API token not configured. Please set it in the plugin settings.", this.settings.errorNoticeDuration)
			return null
		}

		const url = `https://${this.settings.youtrackHost}/api/issues/${issueId}?fields=idReadable,summary`
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${apiToken}`,
					'Accept': 'application/json',
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache'
				}
			})

			if (response.status === 404) {
				return { summary: "~~Not Found~~" }
			}

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`)
			}

			const data = await response.json()
			if (data && data.summary) {
				return {
					summary: data.summary
				}
			}
			return { summary: "~~Not Found~~" }
		} catch (error) {
			new Notice(`Failed to fetch YouTrack issue ${issueId}`, this.settings.errorNoticeDuration)
			return { summary: "~~Not Found~~" }
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	async createSampleNote() {
		const sampleIssues = [
			"#EP-38",
			"#EP-39",
			"#EP-40",
			"#EP-41",
			"#EP-42",
			"#EP-43",
			"#EP-44",
			"#SP-45",
			"#SP-46",
			"#SP-47",
			"#SP-48",
			"#SP-49"
		]

		const sampleContent = `
This is a sample note with YouTrack issues. You can use the "Fetch YouTrack Issue Details" command to fetch the titles for these issues.

${sampleIssues.join("\n")}

## How to use
1. Tag any YouTrack issue in your notes using the format #XXX-XXX where XXX is the project key and XXX is the issue number
2. Run the "Fetch YouTrack Issue Details" command
3. The plugin will fetch and display the issue titles below each issue ID
`

		try {
			const filePath = "YouTrack Issues Sample.md"
			const sampleFile = this.app.vault.getAbstractFileByPath(filePath)
			if (!sampleFile) {
				await this.app.vault.create(filePath, sampleContent)
				new Notice("Sample YouTrack issues note created!", this.settings.noticeDuration)
			}
		} catch (error) {
			new Notice(error.message, this.settings.errorNoticeDuration)
		}
	}
}

class YouTrackSettingTab extends PluginSettingTab {
	plugin: YouTrackIssuePlugin

	constructor(app: App, plugin: YouTrackIssuePlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()
		containerEl.createEl("h2", { text: "YouTrack Issue Settings" })

		new Setting(containerEl)
			.setName("YouTrack API Token")
			.setDesc("Your YouTrack API token for fetching issue details.")
			.addText((text) =>
				text
					.setPlaceholder("Enter your YouTrack API token")
					.setValue(this.plugin.settings.youtrackApiToken)
					.onChange(async (value) => {
						this.plugin.settings.youtrackApiToken = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName("YouTrack Host")
			.setDesc("Your YouTrack host (e.g., gnarus.youtrack.cloud).")
			.addText((text) =>
				text
					.setPlaceholder("Enter your YouTrack host")
					.setValue(this.plugin.settings.youtrackHost)
					.onChange(async (value) => {
						this.plugin.settings.youtrackHost = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName("Notice Duration")
			.setDesc("Duration for general notices in milliseconds (default: 3000).")
			.addText((text) =>
				text
					.setPlaceholder("3000")
					.setValue(this.plugin.settings.noticeDuration.toString())
					.onChange(async (value) => {
						const numValue = parseInt(value) || 3000
						this.plugin.settings.noticeDuration = numValue
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName("Error Notice Duration")
			.setDesc("Duration for error notices in milliseconds (default: 5000).")
			.addText((text) =>
				text
					.setPlaceholder("5000")
					.setValue(this.plugin.settings.errorNoticeDuration.toString())
					.onChange(async (value) => {
						const numValue = parseInt(value) || 5000
						this.plugin.settings.errorNoticeDuration = numValue
						await this.plugin.saveSettings()
					})
			)
	}
}
