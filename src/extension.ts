import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getWebviewContent } from "./get-webview";

interface GPTResponse {
  choices: Array<{
    delta: {
      content: string;
    };
  }>;
}

async function handleGptRequest(apiKey: string, userInput: string) {
  if (!userInput || userInput.trim() === "") {
    vscode.window.showErrorMessage("Input was canceled or empty");
    return;
  }

  const systemPrompt = `
You are a helpful assistant.
Always answer in a markdown format.
When writing code, please keep in mind to properly set the markdown for the appropriate syntax highlight.
`;

  try {
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

    // Create or clean the .gpt_response.md file
    fs.writeFileSync(responseFilePath, ""); // This will wipe the file or create it if it doesn't exist

    // Open the response file in the editor
    const document = await vscode.workspace.openTextDocument(responseFilePath);
    const editor = await vscode.window.showTextDocument(
      document,
      vscode.ViewColumn.Two
    );

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
    let buffer = ""; // Buffer to store incomplete JSON chunks

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
        buffer += chunkLine; // Append current line to the buffer

        try {
          const chunkData: GPTResponse = JSON.parse(buffer);
          const delta = chunkData.choices[0].delta;
          if (delta.content) {
            content += delta.content;
          } else {
            content += "\n";
          }
          buffer = ""; // Clear the buffer if parsing was successful
        } catch (err) {
          // If parsing fails, we wait for more data to be appended to the buffer
          if (!(err instanceof SyntaxError)) {
            vscode.window.showErrorMessage(
              `Unexpected error: ${(err as Error).message}`
            );
            buffer = ""; // Reset buffer on unexpected errors
          }
        }
      }

      // Update the editor content
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, content);
      await vscode.workspace.applyEdit(edit);
      vscode.window.visibleTextEditors.forEach((editor) => {
        if (editor.document.uri.toString() === document.uri.toString()) {
          editor.revealRange(
            new vscode.Range(
              document.lineCount + 1,
              0,
              document.lineCount + 1,
              0
            )
          );
        }
      });
    }

    // Now explicitly save the document to ensure all content is properly stored
    const success = await document.save();
    if (success) {
      vscode.window.showInformationMessage(
        "Response has been saved successfully."
      );
    } else {
      vscode.window.showErrorMessage(
        "Failed to save the response document. Please save the file manually."
      );
    }
  } catch (err) {
    const error = err as Error;
    vscode.window.showErrorMessage(
      `Failed to complete request: ${error.message}`
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "thecodegpt.helloWorld",
    async () => {
      vscode.window.showInformationMessage("Hello, World!!!!");

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

      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case "submit":
            if (!message.text) {
              vscode.window.showErrorMessage("Input was empty");
              return;
            }
            await handleGptRequest(apiKey, message.text);
            panel.dispose(); // Close the Webview Panel after submission
            break;
        }
      });
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
