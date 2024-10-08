import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel
): string {
  const htmlPath = vscode.Uri.file(
    path.join(context.extensionPath, "dist", "webview", "index.html")
  );
  let htmlContent = fs.readFileSync(htmlPath.fsPath, "utf8");
  const styleUri = panel.webview.asWebviewUri(
    vscode.Uri.file(
      path.join(context.extensionPath, "dist", "webview", "style.css")
    )
  );
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(
      path.join(context.extensionPath, "dist", "webview", "script.js") // This should be a bundled file that includes your dependencies
    )
  );
  htmlContent = htmlContent.replace('href="style.css"', `href="${styleUri}"`);
  htmlContent = htmlContent.replace('src="script.js"', `src="${scriptUri}"`);
  return htmlContent;
}
