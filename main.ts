import { App, Editor, MarkdownView, Modal, Notice, Plugin, RequestUrlParam, TFile, TagCache, WorkspaceLeaf, request } from 'obsidian';
import { Configuration, OpenAIApi } from 'openai';
import { DEFAULT_SETTINGS, ZettelGPTSettings, ZettelGPTSettingsTab } from 'src/Setting';
import MarkdownIt from 'markdown-it';
import { Answer, Question } from 'src/template';

interface Metadata {
	[key: string]: string;
}

export default class ZettelGPT extends Plugin {
  settings: ZettelGPTSettings;
  openai: OpenAIApi;
  md: MarkdownIt;

  async onload() {
    await this.loadSettings();
    this.md = new MarkdownIt();

    // setting
    this.addSettingTab(new ZettelGPTSettingsTab(this.app, this));
    const configuration = new Configuration({
      apiKey: this.settings.openAiApiKey,
    });
    this.openai = new OpenAIApi(configuration);

    // Ribbon Button 등록
    this.addRibbonIcon("file-plus", "Insert Question Template", async () => {
      const currentFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
      if (!(currentFile instanceof TFile)) {
        new Notice("Note not found. click the note and retry 🤔");
        throw new Error("현재 노트가 열려있지 않습니다.");
      }
      await app.vault.append(currentFile, Question);
    });
    this.addRibbonIcon("message-circle", "Generate ChatGPT Answer", async () => {
      await this.generateAnswer();
    });
    // this.addRibbonIcon("help-circle", "Generate ChatGPT Answer", async () => {
    //   new Notice('[This button will generate new question file!]');
    // });
    // this.addRibbonIcon("fish", "getConversationHistory", async () => {
    //   const currentFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    //   if (!(currentFile instanceof TFile))
    //     return;
    //   console.log('getContent: ', await this.getConversationHistory(currentFile));
    // });

    // 우측 하단의 statusBar 관련 코드
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('[ZettelGPT in online]');

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
  }

  async generateAnswer() {
    const { vault, workspace } = this.app;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    // Handle case when the active view is not a Markdown file
    if (!activeView) {
      new Notice("Note not found. click the note and retry 🤔");
      throw new Error("현재 노트가 열려있지 않습니다.");
    }
    // Get QuestionFile
    const questionFile = activeView.file;
    // Parse Question
    const questionContent = await this.app.vault.read(questionFile);
    const conversationHistory = await this.getConversationHistory(questionFile);

    // Make answerFile
    const answerFileName = `${questionFile.basename}-answer`;
    const answerFile = await vault.create(`${answerFileName}.md`, '');

    // Open & Read templateFile ===========================

    // const templatePath = 'Template/Answer.md';
    // const templateFile = vault.getAbstractFileByPath(templatePath);
    // if (!(templateFile instanceof TFile)) {
    //   throw new Error(`[${templatePath}]는 적절한 템플릿 파일이 아닙니다.`);
    // }
    // let templateContent = await vault.read(templateFile);
    // console.log('templateContent: ', templateContent);

    let templateContent = Answer;
    // ============================================

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
    // Write the generated content to answerFile
    await vault.append(answerFile, templateContent);

    // Make Answer by chatGPT
    const answerContent :string = await this.getChatGPTAnswer2(conversationHistory, answerFile);

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

  // 질문을 넣으면 stream형식으로 answerFile에 append합니다.
  async getChatGPTAnswer2(messages: any, answerFile: TFile) {
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
        // messages: [
        //   {"role": "system", "content": "You are a helpful assistant."},
        //   {"role": "user", "content": question},
        // ],
        messages,
        model: 'gpt-3.5-turbo',
        //temperature: 0,
        max_tokens: 2048,
        //presence_penalty: 0.0,
        stream: true,
        //    stop: ['\n'],
      }),
    };
    console.log('apiKey: ', apiKey);
    const message = {
      "role": "assistant",
      "content": ""
    };

    fetch(endpointUrl, fetchOptions).then(async (response) => {
    const r = response.body;  // 왜 r은 ReadableStream이라는 형으로 추정되는건지 모르겠다.
    if (!r) throw new Error('No response body');

    const d = new TextDecoder('utf8');
    const reader = await r.getReader();
    const fullText = ''
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
            console.log('line: ', line);
            const delta: any = JSON.parse(line.slice(6)).choices[0].delta;
            if (delta.hasOwnProperty("role"))
              message["role"] = delta["role"];
            else if (delta.hasOwnProperty("content")) {
              console.log('content: ', message["content"]);
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

  async parseQuestionFromString(questionContent: string): Promise<string> {
    //const notesRegex = /^##\s*내용:\s*((?:\n|.)*?)^###\s/m;
    //const notesRegex = /^##\s내용:\n----\s*((?:\n|.)*?)^----\s/m;
    const notesRegex = /## 내용:\n([\s\S]*)/;
    const notesMatch = questionContent.match(notesRegex);
    const notesParagraph = notesMatch ? notesMatch[1] : '';

    console.log('notesParagraph: ', notesParagraph);

    return notesParagraph;
  }

  // debug function
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
    // 질문을 뽑아내는 형식은 여기서 결정됩니다.
    const notesRegex = /^###\s*메모:\s*((?:\n|.)*?)^###\s/m;
    const notesMatch = fileContent.match(notesRegex);
    const notesParagraph = notesMatch ? notesMatch[1] : '';

    console.log('notesParagraph: ', notesParagraph);

    return notesParagraph;
  }

  async printFileMetadataCache(file: TFile) {
    const cache = this.app.metadataCache.getFileCache(file);
    console.log('cache: ', cache);
  }

  async getConversationHistory(inputFile: TFile): Promise<any> {
    // 연결된 파일이 없다면, 현재 파일의 질문내용을 return 한다.
    const cache = this.app.metadataCache.getFileCache(inputFile)
    const links = cache?.links;
    const tags = cache?.tags as TagCache[];  // tags[1] 값은 #question, #answer 중 하나여야만 합니다.

    const FileContent = await this.app.vault.read(inputFile);
    const content = await this.parseQuestionFromString(FileContent);
    console.log('links: ', links);
    if (links === undefined) {
      return [
        { "role": "system", "content": "You are a helpful assistant." },
        { "role": "user", "content": content }
      ];
    }
    const linkFile: TFile = this.app.vault.getAbstractFileByPath(`${links[0].link}.md`) as TFile;
    console.log('linkFile: ', linkFile);
    const ret: any = await this.getConversationHistory(linkFile);
    console.log('ret: ', ret);
    return [ ...ret, {
      "role": tags[1].tag === "#answer" ? "assistant" : "user",
      "content": content,
    }];
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
