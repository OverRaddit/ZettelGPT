# Obsidian ZettelGPT Plugin

To download Obsidian: [Click here](https://www.obsidian.md)

<a href="https://www.buymeacoffee.com/Overraddit" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 40px !important;width: 150px !important;"></a>

![ZettelGPTDemo](https://user-images.githubusercontent.com/30787477/233355651-81973be2-ab49-4333-88a1-f8074ac3ee14.gif)

Welcome to the ZettelGPT plugin for Obsidian! 🎉 This awesome plugin helps you generate answers from ChatGPT based on your questions, while keeping the conversation history clear and organized. Save GPT tokens and enjoy a smooth interaction with ChatGPT! 🚀

## Features 🌟

### 1. Contextual Conversations 📚

Efficiently interact with ChatGPT by providing only the relevant conversation history, optimizing GPT token usage, and preserving context across independent questions.

### 2. Self-Contained Environment 🏡

Ask questions within a self-contained environment, ensuring the context of previous questions is maintained, even when asking additional questions in the same environment.

### 3. Visual Clarity 🔍

Easily understand and navigate your conversation with ChatGPT through Obsidian's graph view, which visually connects question notes and answer notes for a clear and organized overview.

## Setup ⚙️

In order to configure the plugin, you must first set your OpenAI API key in the plugin settings. Please note that using the OpenAI API might require payment. Check OpenAI's pricing details [here](https://openai.com/pricing).

Generate an OpenAI API key [here](https://beta.openai.com/signup).
In Obsidian, go to Settings and select ZettelGPT from the "Community Plugins" in the left menu.
Enter your OpenAI API key.

Please be aware that this plugin uploads note content to OpenAI servers to be compliant with Obsidian's developer policies.

Currently, the plugin uses GPT-3.5 Turbo, but we plan to update it to support other models in the future.

## How to use 🎓

1. Create a new note and click the "Insert Question Template" button. ✍️
2. Scroll to the bottom of the note and type your question in the designated field. ❓
3. Click the "Generate Answer" button to receive ChatGPT's response. The answer will appear in real-time within a connected answer note. 🤖
4. To ask additional questions, repeat steps 1-2, and then link the new question note to the desired answer note before proceeding to step 3. 🔄

## Description 📝

In your ZettelGPT plugin, users can create question notes and answer notes, where the answer notes use the question from the question note and the history of the conversation up to that point. 📝 By providing only the relevant conversation history, you can save GPT tokens and optimize the plugin's efficiency. 💡

Your implementation also allows for asking questions in a self-contained environment. 🏡 For example, if a user asks 10 questions to GPT, the context of these questions could be lost when asking an additional question after three more unrelated questions. 😕 However, with your plugin, you only pass the conversation history from the base node to the current leaf node, allowing users to ask independent questions in the same environment without losing the context of previous questions. 🌟

By combining these features, your ZettelGPT plugin offers an efficient and context-aware solution for asking questions and generating answers within Obsidian, enabling users to maintain a clear and organized conversation history with ChatGPT. 🤖

Enjoy your conversation with ChatGPT using the ZettelGPT plugin for Obsidian! 🎈
