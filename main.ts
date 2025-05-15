import { Plugin, Notice } from "obsidian"

export default class CopyTaggedItemsPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: "copy-tagged-items-to-bottom",
			name: "Copy Tagged",
			callback: async () => {
				const file = this.app.workspace.getActiveFile()
				if (!file) {
					new Notice("No active file found.")
					return
				}
				let content = await this.app.vault.read(file)
				const lines = content.split("\n")
				const tagged = lines.filter(line => /#[\w-]+/.test(line))
				if (tagged.length === 0) {
					new Notice("No tagged items found in this note.")
					return
				}
				content += "\n" + tagged.join("\n")
				await this.app.vault.modify(file, content)
				new Notice("Tagged items copied to bottom of note.")
			}
		})
	}

	async onunload() {}
}
