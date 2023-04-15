import { App, Editor, MarkdownView, Modal, Notice, Plugin, RequestUrlParam, TFile, WorkspaceLeaf, request } from 'obsidian';
import { Configuration, OpenAIApi } from 'openai';
import { DEFAULT_SETTINGS, ZettelGPTSettings, ZettelGPTSettingsTab } from 'src/Setting';

interface Metadata {
	[key: string]: string;
}

export default class MyPlugin extends Plugin {
  settings: ZettelGPTSettings;
  openai: OpenAIApi;

  async onload() {
    await this.loadSettings();

    // setting
    this.addSettingTab(new ZettelGPTSettingsTab(this.app, this));
    const configuration = new Configuration({
      apiKey: this.settings.openAiApiKey,
    });
    this.openai = new OpenAIApi(configuration);

    // Ribbon Button 등록
    this.addRibbonIcon("info", "Calculate average file length", async () => {
      //this.
      const fileLength = await this.parseQuestionFromCurrentFile();
      new Notice(`Your Question is [${fileLength}]`);
    });

    this.addRibbonIcon("message-circle", "Generate ChatGPT Answer", async () => {
      await this.generateAnswer();
    });

  // 좌측 플러그인 아이콘 관련 코드
    const ribbonIconEl = this.addRibbonIcon('dice', '[this text is shown when you place your mouse on here]', (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      new Notice('[This is a notice! by gshim!]');
      this.createGshimFile();
    });
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('my-plugin-ribbon-class');

  // 우측 하단의 statusBar 관련 코드
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('[Status Bar Text by gshim@@@@@@@@]');

    // 단축키 기반 커맨드 등록
    this.addCommand({
      id: 'generate-chatgpt-answer',
      name: 'Generate ChatGPT Answer',
      hotkeys: [
        {
          modifiers: ['Mod', 'Shift'],
          key: 'G',
        },
      ],
			callback: this.generateAnswer.bind(this),
		});

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-sample-modal-simple',
      name: 'Open sample modal (simple)',
      callback: () => {
        new SampleModal(this.app).open();
      }
    });
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: 'sample-editor-command',
      name: 'Sample editor command',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        console.log(editor.getSelection());
        editor.replaceSelection('Sample Editor Command');
      }
    });
    // This adds a complex command that can check whether the current state of the app allows execution of the command
    this.addCommand({
      id: 'open-sample-modal-complex',
      name: 'Open sample modal (complex)',
      checkCallback: (checking: boolean) => {
        // Conditions to check
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
          // If checking is true, we're simply "checking" if the command can be run.
          // If checking is false, then we want to actually perform the operation.
          if (!checking) {
            new SampleModal(this.app).open();
          }

          // This command will only show up in Command Palette when the check function returns true
          return true;
        }
      }
    });

  // ???
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file, source) => {
        menu.addItem((item) => {
        item.setTitle('Create gshim.md file')
          .setIcon('plus')
          .onClick(() => this.createGshimFile());
        });
      })
    );

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
      console.log('click', evt);
    });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
  }

  async createGshimFile() {
    const fileName = 'gshim.md';
    const existingFile = this.app.vault.getAbstractFileByPath(fileName);

    if (!existingFile) {
      await this.app.vault.create(fileName, '');
      console.log('gshim.md file created');
      new Notice('gshim.md file created');
    } else {
      console.log('gshim.md file already exists');
      new Notice('gshim.md file already exists');
    }
  }

  async generateAnswer() {
    const { vault, workspace } = this.app;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    // Handle case when the active view is not a Markdown file
    if (!activeView) {
      throw new Error("현재 노트가 열려있지 않습니다.");
    }
    // Get QuestionFile
    const questionFile = activeView.file;
    // Parse Question
    const questionContent = await this.app.vault.read(questionFile);

    // =================================
    const answerFileName = `${questionFile.basename}-answer.md`;

    // Open templateFile
    const templatePath = 'Template/Answer.md';
    const templateFile = vault.getAbstractFileByPath(templatePath);
    //const templateFile = vault.getAbstractFileByPath(templatePath) as TFile;
    if (!(templateFile instanceof TFile)) {
      throw new Error(`[${templatePath}]는 적절한 템플릿 파일이 아닙니다.`);
    }

    // Read the template content
    let templateContent = await vault.read(templateFile);
    console.log('templateContent: ', templateContent);

    // Insert the metadata into the template content
    const metadata: Metadata = {
      title: answerFileName,
      linked_note: `[[${questionFile.basename}]]`,
      // content: answerContent,
    }

    // replace metadata
    for (const key in metadata) {
      const placeholder = `{{${key}}}`;
      const value = metadata[key];
      templateContent = templateContent.replace(placeholder, value);
    }

    // Create the new file with the generated content
    const fileName = `${answerFileName}.md`;
    const answerFile = await vault.create(fileName, templateContent);

    // =================================

    // Make Answer by chatGPT
    //const answerContent :string = await this.getChatGPTAnswer(questionContent);
    const answerContent :string = await this.getChatGPTAnswer2(questionContent, answerFile);


    // createNewNoteFromTemplate를 분리하자...
    //await this.createNewNoteFromTemplate(templatePath, questionFile, answerContent);

    // Open & display AnswerFile
    const recentLeaf = workspace.getMostRecentLeaf();
    if (answerFile instanceof TFile && recentLeaf instanceof WorkspaceLeaf)
      recentLeaf.openFile(answerFile);
    else
      throw new Error("답변 파일이 제대로 생성되지 않았거나, workspaceleaf 생성에 실패했습니다.");
  }

  async getChatGPTAnswer(question: string) {
    new Notice('getChatGPTAnswer start!');

    const apiKey = this.settings.openAiApiKey;
    const endpointUrl = 'https://api.openai.com/v1/chat/completions';

    const requestOptions: RequestUrlParam = {
      url: endpointUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages: [
          {"role": "system", "content": "You are a helpful assistant that speak korean."},
          {"role": "user", "content": question}
        ],
        model: 'gpt-3.5-turbo',
        max_tokens: 2048,
        temperature: 0.7,
        //stream: true
      })
    };
    const response: any = await request(requestOptions);
    const res = JSON.parse(response);
    new Notice('getChatGPTAnswer end!');
    return res.choices[0].message.content;
  }

  async getChatGPTAnswerByStream(question: string) {
    console.log('getChatGPTAnswerByStream start!');
    new Notice('getChatGPTAnswerByStream start!');

    const apiKey = this.settings.openAiApiKey;
    const endpointUrl = 'https://api.openai.com/v1/chat/completions';
    const prompt = 'what is google?';

    const response = await this.openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {"role": "system", "content": "You are a helpful assistant that translates English to French."},
        {"role": "user", "content": prompt}
      ],
      stream: true,
    }, { responseType: 'stream' });
    console.log('getChatGPTAnswerByStream end!');
    new Notice('getChatGPTAnswerByStream end!');

    return "sample text";
  }

	async getChatGPTAnswer2(question: string, answerFile: TFile) {
    const apiKey = this.settings.openAiApiKey;
    const endpointUrl = 'https://api.openai.com/v1/chat/completions';
    const fetchOptions = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": question}
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0,
        max_tokens: 2048,
        presence_penalty: 0.0,
        stream: true,
        //    stop: ['\n'],
      }),
    };

    /*
      messages: [
        {"role": "system", "content": "You are a helpful assistant that speak korean."},
        {"role": "user", "content": question}
      ],
    */
    let message: any = {
      "role": "assistant",
      "content": ""
    };

    fetch(endpointUrl, fetchOptions).then(async (response) => {
    const r = response.body;  // 왜 r은 ReadableStream이라는 형으로 추정되는건지 모르겠다.
    if (!r) throw new Error('No response body');

    const d = new TextDecoder('utf8');
    const reader = await r.getReader();
    let fullText = ''
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log('done');
        break;
      } else {
        const decodedString = d.decode(value);
        // 가끔씩 하나의 청크에 2개의 data가 들어가있다.
        const lines = decodedString.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          try {
            const delta: any = JSON.parse(line.slice(6)).choices[0].delta;
            if (delta.hasOwnProperty("role"))
              message["role"] = delta["role"];
            else if (delta.hasOwnProperty("content")) {
              message["content"] += delta["content"];
              // 1안 열려있는 파일의 특정 placeholder를 replace한다.

              // 2안 각 content를 append한다.
              this.app.vault.append(answerFile, delta["content"]);
            }
            console.log(message);
          } catch (e) {
            // the last line is data: [DONE] which is not parseable either, so we catch that.
            console.log(
            e, '\n\n\n\n',
            'But parsed string is below\n\n\n\n',
            );
            console.log(fullText);
          }
        }
      }
    }
    });
    return 'a';
	}

  // about file....
  async parseQuestionFromCurrentFile(): Promise<string> {
    const { vault } = this.app;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice('현재 질문파일이 열려있지 않습니다.');
      throw new Error("질문 파일이 없음");
    }
    const questionFile = activeView.file;
    const fileContent = await vault.read(questionFile);

    // extract the notes paragraph using regular expressions
    const notesRegex = /^###\s*메모:\s*((?:\n|.)*?)^###\s/m;
    const notesMatch = fileContent.match(notesRegex);
    const notesParagraph = notesMatch ? notesMatch[1] : '';

    console.log('notesParagraph: ', notesParagraph);

    return notesParagraph;
  };

  async createNewNoteFromTemplate(templatePath: string, questionFile: TFile, answerContent: string): Promise<void> {
    const { vault, workspace } = this.app;
    const answerFileName = `${questionFile.basename}-answer.md`;

    // Open templateFile
    const templateFile = vault.getAbstractFileByPath(templatePath);
    if (!(templateFile instanceof TFile)) {
      throw new Error(`[${templatePath}]는 적절한 템플릿 파일이 아닙니다.`);
    }

    // Read the template content
    let templateContent = await vault.read(templateFile);
    console.log('templateContent: ', templateContent);

    // Insert the metadata into the template content
    const metadata: Metadata = {
      title: answerFileName,
      linked_note: `[[${questionFile.basename}]]`,
      content: answerContent,
    }

    // replace metadata
    for (const key in metadata) {
      const placeholder = `{{${key}}}`;
      const value = metadata[key];
      templateContent = templateContent.replace(placeholder, value);
    }

    // Create the new file with the generated content
    const fileName = `${answerFileName}.md`;
    await vault.create(fileName, templateContent);

    // Open & display AnswerFile
    const newFile = await vault.getAbstractFileByPath(fileName);
    const recentLeaf = workspace.getMostRecentLeaf();
    if (newFile instanceof TFile && recentLeaf instanceof WorkspaceLeaf)
      recentLeaf.openFile(newFile);
    else
      throw new Error("답변 파일이 제대로 생성되지 않았거나, workspaceleaf 생성에 실패했습니다.");
  }

  async onunload() {
    await this.saveData(this.settings);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
