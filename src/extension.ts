// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

function getWebviewContent() {
  return `
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>GPT Input</title>
		<style>
			body {
				font-family: Arial, sans-serif;
				margin: 0;
				padding: 10px;
				background-color: #1e1e1e;
				color: white;
			}
			textarea {
				width: 100%;
				height: 200px;
				padding: 10px;
				margin-bottom: 10px;
				border-radius: 5px;
				border: 1px solid #555;
				background-color: #252526;
				color: white;
			}
			button {
				padding: 10px 20px;
				border-radius: 5px;
				border: none;
				background-color: #007acc;
				color: white;
				cursor: pointer;
			}
			button:hover {
				background-color: #005fa1;
			}
		</style>
	</head>
	<body>
		<h2>Enter your prompt:</h2>
		<textarea id="input"></textarea>
		<button onclick="submit()">Submit</button>
		<script>
			const vscode = acquireVsCodeApi();
			function submit() {
				const input = document.getElementById('input').value;
				vscode.postMessage({
					command: 'submit',
					text: input
				});
			}
		</script>
	</body>
</html>
    `;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "thecodegpt.helloWorld",
    async () => {
      vscode.window.showInformationMessage("Hello, World!");

      const panel = vscode.window.createWebviewPanel(
        "gptInput",
        "GPT Input",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );
      panel.webview.html = getWebviewContent();
      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case "submit":
            if (!message.text) {
              vscode.window.showErrorMessage("Input was empty");
              return;
            }
            vscode.window.showInformationMessage(`Received: ${message.text}`);
            panel.dispose();
            break;
        }
      });

      // const userPrompt = await vscode.window.showInputBox({
      //   prompt: "User Prompt",
      // });
      // if (!userPrompt) {
      //   vscode.window.showErrorMessage("Input was canceled or empty");
      //   return;
      // }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
