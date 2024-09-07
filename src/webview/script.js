const vscode = acquireVsCodeApi();

window.addEventListener("keypress", (event) => {
  if (event.ctrlKey && event.key === "Enter") {
    submit();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("input").focus();
  document.getElementById("defaultOpen").click();  // Open the first tab by default
});

function submit() {
  const inputElement = document.getElementById('input');
  const inputValue = inputElement.value;  
  vscode.postMessage({
      command: 'submit',
      text: inputValue
  });
}

function openTab(evt, tabName) {
  const tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
    tabcontent[i].classList.remove("active");
  }
  const tablinks = document.getElementsByClassName("tablinks");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tabName).style.display = "block";
  document.getElementById(tabName).classList.add("active");
  evt.currentTarget.className += " active";
}

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "setSystemPrompt":
      document.getElementById("systemPrompt").textContent = message.systemPrompt;
      break;
  }
});
