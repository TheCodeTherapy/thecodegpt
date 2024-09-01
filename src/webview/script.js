const vscode = acquireVsCodeApi();

window.addEventListener("keypress", (event) => {
  // check if Ctrl+Enter is pressed
  if (event.ctrlKey && event.key === "Enter") {
    submit();
  }
});

function submit() {
  const inputElement = document.getElementById('input');
  const inputValue = inputElement.value;  
  vscode.postMessage({
      command: 'submit',
      text: inputValue
  });
}
