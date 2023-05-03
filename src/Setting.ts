import { App, PluginSettingTab, Setting } from "obsidian";
import ZettelGPT from "main";

// 플러그인 설정스펙 인터페이스를 의미합니다.
export interface ZettelGPTSettings {
	openAiApiKey: string;
}

// 설정값들에 대한 기본값을 명시하는 용도...?
export const DEFAULT_SETTINGS: ZettelGPTSettings = {
	openAiApiKey: '',
}

// 플러그인 셋팅 UI를 명시하는 클래스
export class ZettelGPTSettingsTab extends PluginSettingTab {
  plugin: ZettelGPT;

  constructor(app: App, plugin: ZettelGPT) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h1', { text: 'ZettelGPT Settings' });

    new Setting(containerEl)
    .setName('OpenAI API Key')
    .setDesc('Enter your OpenAI API key')
    .addText((text) =>
      text
      .setPlaceholder('Enter your API key here...')
      .setValue(this.plugin.settings.openAiApiKey)
      .onChange(async (value) => {
        this.plugin.settings.openAiApiKey = value;
        await this.plugin.saveData(this.plugin.settings);
      })
    );
  }
}
