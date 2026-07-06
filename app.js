const input = document.querySelector("#jsonInput");
const output = document.querySelector("#jsonOutput code");
const statusBox = document.querySelector("#status");
const outputMeta = document.querySelector("#outputMeta");
const searchInput = document.querySelector("#searchInput");
const searchCount = document.querySelector("#searchCount");
const formatBtn = document.querySelector("#formatBtn");
const repairBtn = document.querySelector("#repairBtn");
const clearBtn = document.querySelector("#clearBtn");
const copyBtn = document.querySelector("#copyBtn");
const modeButtons = document.querySelectorAll(".mode-button");

let currentMode = "pretty";
let currentText = "";
let lastJsonValue = null;

const sampleJson = {
  app: "JSON Formatter",
  features: ["validate", "format", "minify", "repair", "search"],
  deployableAs: "static website"
};

input.value = JSON.stringify(sampleJson);

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function getIndent() {
  return currentMode === "pretty" ? 2 : 0;
}

function stringifyJson(value) {
  return JSON.stringify(value, null, getIndent());
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const escapes = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return escapes[char];
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updateOutput(text) {
  currentText = text;
  renderSearch();
  outputMeta.textContent = text ? `${text.length.toLocaleString()} characters` : "No output yet";
}

function renderSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    output.innerHTML = escapeHtml(currentText);
    searchCount.textContent = "0 matches";
    return;
  }

  const regex = new RegExp(escapeRegExp(query), "gi");
  let count = 0;
  const highlighted = escapeHtml(currentText).replace(regex, (match) => {
    count += 1;
    return `<mark>${match}</mark>`;
  });

  output.innerHTML = highlighted;
  searchCount.textContent = `${count} ${count === 1 ? "match" : "matches"}`;
}

function parseJson(text) {
  return JSON.parse(text);
}

function normalizeSingleQuotedJson(text) {
  let result = "";
  let inSingle = false;
  let inDouble = false;
  let escaping = false;

  for (const char of text) {
    if (escaping) {
      result += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaping = true;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      result += char;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      result += '"';
      continue;
    }

    result += char;
  }

  return result;
}

function repairJsonText(text) {
  return normalizeSingleQuotedJson(text)
    .trim()
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
}

function formatJson({ repair = false } = {}) {
  const raw = input.value.trim();
  if (!raw) {
    lastJsonValue = null;
    updateOutput("");
    setStatus("Paste JSON to get started");
    return;
  }

  try {
    const value = parseJson(repair ? repairJsonText(raw) : raw);
    lastJsonValue = value;
    updateOutput(stringifyJson(value));
    setStatus(repair ? "JSON repaired and formatted" : "Valid JSON formatted", repair ? "repaired" : "valid");
  } catch (error) {
    lastJsonValue = null;
    updateOutput("");
    setStatus(`Invalid JSON: ${error.message}`, "invalid");
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    if (lastJsonValue === null) {
      formatJson();
      return;
    }

    updateOutput(stringifyJson(lastJsonValue));
  });
});

formatBtn.addEventListener("click", () => formatJson());
repairBtn.addEventListener("click", () => formatJson({ repair: true }));
searchInput.addEventListener("input", renderSearch);
input.addEventListener("input", () => {
  lastJsonValue = null;
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  lastJsonValue = null;
  updateOutput("");
  setStatus("Cleared");
  input.focus();
});

copyBtn.addEventListener("click", async () => {
  if (!currentText) {
    setStatus("Nothing to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(currentText);
    setStatus("Output copied", "valid");
  } catch {
    setStatus("Copy failed. Select the output and copy manually.", "invalid");
  }
});

formatJson();
