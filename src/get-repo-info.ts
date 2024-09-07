import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { exec } from "child_process";
import * as vscode from "vscode";

const execPromise = util.promisify(exec);

interface RepoInfoConfig {
  codeFileExtensions?: string[];
  ignoredDirectories?: string[];
  includeSpecificFiles?: string[];
}

// Default configuration
let defaultFileTypes: Array<string> = [
  ".cpp",
  ".hpp",
  ".c",
  ".h",
  ".js",
  ".ts",
  ".tsx",
  ".csj",
  ".mjs",
  ".fs",
  ".vs",
  ".glsl",
  ".html",
  ".css",
  ".scss",
  ".py",
  ".sh",
];

let ignoredDirectories: Array<string> = [];
let includedFiles: Array<string> = [];

// Function to load and parse .repoinfo.json if it exists
function loadRepoInfoConfig(dir: string): RepoInfoConfig | null {
  const configFilePath = path.join(dir, ".repoinfo.json");
  if (fs.existsSync(configFilePath)) {
    const configFileContent = fs.readFileSync(configFilePath, "utf-8");
    try {
      return JSON.parse(configFileContent);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error parsing .repoinfo.json: ${(error as Error).message}`
      );
      return null;
    }
  }
  return null;
}

// Function to replace non-standard spaces in a string
function replaceNonStandardSpaces(input: string): string {
  const nonStandardSpaces: { [key: string]: string } = {
    "\xC2\xA0": " ",
    "\xE2\x80\x80": " ",
    "\xE2\x80\x81": " ",
    "\xE2\x80\x82": " ",
    "\xE2\x80\x83": " ",
    "\xE2\x80\x84": " ",
    "\xE2\x80\x85": " ",
    "\xE2\x80\x86": " ",
    "\xE2\x80\x87": " ",
    "\xE2\x80\x88": " ",
    "\xE2\x80\x89": " ",
    "\xE2\x80\x8A": " ",
    "\xE2\x80\xAF": " ",
    "\xE2\x81\x9F": " ",
    "\xE3\x80\x80": " ",
  };

  let output = input;
  for (const [nonStandard, replacement] of Object.entries(nonStandardSpaces)) {
    const regex = new RegExp(nonStandard, "g");
    output = output.replace(regex, replacement);
  }
  return output;
}

// Function to generate a tree structure of the directory
async function generateTreeStructure(dir: string): Promise<string> {
  const command = `tree -q --noreport --gitignore -L 3 -I "*.json|*.md|deps|build"`;
  const { stdout } = await execPromise(command, { cwd: dir });
  return replaceNonStandardSpaces(stdout);
}

// Function to recursively gather contents of specified files
// Function to recursively gather contents of specified files
function gatherFileContents(dir: string): string {
  let contents = "";

  function walkDirectory(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const fullPath = path.join(currentPath, file);
      const relativePath = path.relative(dir, fullPath);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip ignored directories
        if (!ignoredDirectories.includes(relativePath)) {
          walkDirectory(fullPath);
        }
      } else {
        const ext = path.extname(file);

        // Simplified condition to ensure the file is included if it matches the extension
        if (
          defaultFileTypes.includes(ext) ||
          includedFiles.includes(relativePath)
        ) {
          console.log(`Reading file: ${relativePath}`);
          const fileContent = fs.readFileSync(fullPath, "utf-8");
          contents += `\n${relativePath}:\n\`\`\`\n${fileContent}\n\`\`\`\n`;
        } else {
          console.log(`Skipping file: ${relativePath}`);
        }
      }
    });
  }

  walkDirectory(dir);

  return contents;
}

// Main function to generate repository information
async function generateRepoInfo(dir: string): Promise<string> {
  // Load the .repoinfo.json if it exists
  const config = loadRepoInfoConfig(dir);

  if (config) {
    if (config.codeFileExtensions) {
      defaultFileTypes = config.codeFileExtensions;
    }
    if (config.ignoredDirectories) {
      ignoredDirectories = config.ignoredDirectories;
    }
    if (config.includeSpecificFiles) {
      includedFiles = config.includeSpecificFiles;
    }
  }

  const treeStructure = await generateTreeStructure(dir);
  const fileContents = gatherFileContents(dir);

  let repoInfo = `The basic structure of the app is as follows:\n\`\`\`\n`;
  repoInfo += treeStructure;
  repoInfo += `\n\`\`\`\n`;
  repoInfo += fileContents;

  return repoInfo;
}

// Function to get repo info and inject it into the system prompt
export async function getRepoInfoForPrompt(): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error(
      "No workspace folder is open. Please open a folder in VS Code."
    );
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const repoInfo = await generateRepoInfo(workspacePath);

  const systemPrompt = `
You are a helpful assistant.
Here is some information about the repository you are working with:
${repoInfo}
Always answer in a markdown format.
When writing code, please keep in mind to properly set the markdown for the appropriate syntax highlight.
`;

  return systemPrompt;
}

// If this script is run directly, output the generated repo info
if (require.main === module) {
  (async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const info = await generateRepoInfo(workspaceFolders[0].uri.fsPath);
      console.log(info);
    } else {
      console.log("No workspace folder is open.");
    }
  })();
}
