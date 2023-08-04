import { MarkdownView, Notice, Plugin, RequestUrlParam, TFile, TagCache, WorkspaceLeaf, request } from 'obsidian';
import { Configuration, OpenAIApi } from 'openai';
import { DEFAULT_SETTINGS, ZettelGPTSettings, ZettelGPTSettingsTab } from 'src/Setting';
import { Answer, Question } from 'src/template';

interface Metadata {
	[key: string]: string;
}

export default class ZettelGPT extends Plugin {
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

    // 우측 하단의 statusBar 관련 코드
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('[ZettelGPT in online]');

    // 단축키 기반 커맨드 등록
    this.addCommand({
      id: 'generate-chatgpt-answer',
      name: 'Generate ChatGPT Answer',
			callback: this.generateAnswer.bind(this),
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
    await this.app.vault.cachedRead(questionFile);
    const conversationHistory = await this.getConversationHistory(questionFile);

    // Make answerFile
    const answerFileName = `${questionFile.basename}-answer`;
    const answerFile = await vault.create(`${answerFileName}.md`, '');

    let templateContent = Answer;

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
    await this.getChatGPTAnswer2(conversationHistory, answerFile);

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
    const message = {
      "role": "assistant",
      "content": ""
    };

    fetch(endpointUrl, fetchOptions).then(async (response) => {
    const r = response.body;  // 왜 r은 ReadableStream이라는 형으로 추정되는건지 모르겠다.
    if (!r) throw new Error('No response body');

    const d = new TextDecoder('utf8');
    const reader = await r.getReader();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
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
          } catch (e) {
            // the last line is data: [DONE] which is not parseable either, so we catch that.
          }
        }
      }
    }
    });
    return 'a';
	}

  async parseQuestionFromString(questionContent: string): Promise<string> {
    const notesRegex = /## 내용:\n([\s\S]*)/;
    const notesMatch = questionContent.match(notesRegex);
    const notesParagraph = notesMatch ? notesMatch[1] : '';

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
    const fileContent = await vault.cachedRead(questionFile);

    // extract the notes paragraph using regular expressions
    // 질문을 뽑아내는 형식은 여기서 결정됩니다.
    const notesRegex = /^###\s*메모:\s*((?:\n|.)*?)^###\s/m;
    const notesMatch = fileContent.match(notesRegex);
    const notesParagraph = notesMatch ? notesMatch[1] : '';

    console.log('notesParagraph: ', notesParagraph);

    return notesParagraph;
  }

  async getConversationHistory(inputFile: TFile): Promise<any> {
    // 연결된 파일이 없다면, 현재 파일의 질문내용을 return 한다.
    const cache = this.app.metadataCache.getFileCache(inputFile)
    const links = cache?.links;
    const tags = cache?.tags as TagCache[];  // tags[1] 값은 #question, #answer 중 하나여야만 합니다.

    const FileContent = await this.app.vault.cachedRead(inputFile);
    const content = await this.parseQuestionFromString(FileContent);
    if (links === undefined) {
      return [
        { "role": "system", "content": "You are a helpful assistant." },
        { "role": "user", "content": content }
      ];
    }
    const linkFile: TFile = this.app.vault.getAbstractFileByPath(`${links[0].link}.md`) as TFile;
    const ret: any = await this.getConversationHistory(linkFile);
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
