import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getWebviewContent } from "./get-webview";
import { getRepoInfoForPrompt } from "./get-repo-info";

export function activate(context: vscode.ExtensionContext) {
  const questionDisposable = vscode.commands.registerCommand(
    "thecodegpt.question",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        vscode.window.showErrorMessage("OPENAI_API_KEY is not set.");
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        "gptInput",
        "GPT Input",
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
        }
      );

      panel.webview.html = getWebviewContent(context, panel);

      // Generate the system prompt
      const systemPrompt = await getRepoInfoForPrompt();

      // Send the system prompt to the webview
      panel.webview.postMessage({
        command: "setSystemPrompt",
        systemPrompt: systemPrompt,
      });

      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case "submit":
            if (!message.text) {
              vscode.window.showErrorMessage("Input was empty");
              return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
              vscode.window.showErrorMessage(
                "No workspace folder is open. Please open a folder in VS Code."
              );
              return;
            }

            const responseFilePath = path.join(
              workspaceFolders[0].uri.fsPath,
              ".gpt_response.md"
            );

            fs.writeFileSync(responseFilePath, "# GPT Response\n");

            panel.dispose();

            await vscode.commands.executeCommand(
              "markdown.showPreviewToSide",
              vscode.Uri.file(responseFilePath),
              vscode.ViewColumn.Two
            );

            await handleGptRequest(apiKey, message.text, responseFilePath);
            break;
        }
      });
    }
  );

  context.subscriptions.push(questionDisposable);
}

async function handleGptRequest(
  apiKey: string,
  userInput: string,
  responseFilePath: string
) {
  try {
    const repoInfo = await getRepoInfoForPrompt();
    const systemPrompt = `
You are a helpful assistant.
Here is some information about the repository you are working with:

${repoInfo}

Always answer in a markdown format.
When writing code, please keep in mind to properly set the markdown for the appropriate syntax highlight.
Please be brief and short about explanations, and give preference to in-code comments to explain the code.
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        max_tokens: 1500,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let content = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader?.read()!;
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const chunkLines = chunk.split("\n");

      for (let chunkLine of chunkLines) {
        chunkLine = chunkLine.trim();
        if (chunkLine === "" || chunkLine === "data: [DONE]") {
          continue;
        }

        chunkLine = chunkLine.replace(/^data:\s?/, "");
        buffer += chunkLine;

        try {
          const chunkData = JSON.parse(buffer);
          const delta = chunkData.choices[0].delta;
          if (delta.content) {
            content += delta.content;
          } else {
            content += "\n";
          }
          buffer = "";
        } catch (err) {
          if (!(err instanceof SyntaxError)) {
            vscode.window.showErrorMessage(
              `Unexpected error: ${(err as Error).message}`
            );
            buffer = "";
          }
        }
      }

      fs.writeFileSync(responseFilePath, content);
    }

    vscode.window.showInformationMessage(
      "Response has been saved successfully."
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to complete request: ${(err as Error).message}`
    );
  }
}

export function deactivate() {}
