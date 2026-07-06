const input = document.querySelector("#jsonInput");
const inputEditor = document.querySelector("#inputEditor");
const inputHighlight = document.querySelector("#inputHighlight");
const output = document.querySelector("#jsonOutput code");
const outputPre = document.querySelector("#jsonOutput");
const treeOutput = document.querySelector("#treeOutput");
const statusBox = document.querySelector("#status");
const statusText = document.querySelector("#statusText");
const inputMeta = document.querySelector("#inputMeta");
const fileName = document.querySelector("#fileName");
const inputValidation = document.querySelector("#inputValidation");
const outputMeta = document.querySelector("#outputMeta");
const searchRow = document.querySelector("#searchRow");
const searchInput = document.querySelector("#searchInput");
const searchCount = document.querySelector("#searchCount");
const searchPrevBtn = document.querySelector("#searchPrevBtn");
const searchNextBtn = document.querySelector("#searchNextBtn");
const treeActions = document.querySelector("#treeActions");
const expandAllBtn = document.querySelector("#expandAllBtn");
const collapseAllBtn = document.querySelector("#collapseAllBtn");
const formatBtn = document.querySelector("#formatBtn");
const repairBtn = document.querySelector("#repairBtn");
const clearBtn = document.querySelector("#clearBtn");
const copyBtn = document.querySelector("#copyBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const validateBtn = document.querySelector("#validateBtn");
const fileInput = document.querySelector("#jsonFileInput");
const modeButtons = document.querySelectorAll(".mode-button");

let currentMode = "pretty";
let currentText = "";
let lastJsonValue = null;
const collapsedTreePaths = new Set();
let treeMatchCount = 0;
let treeMatchIndex = -1;

const EMPTY_INPUT_MESSAGE = "Paste JSON, or upload a .json file, to check for errors.";
const VALID_INPUT_MESSAGE = "Valid JSON. Ready to format.";

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function setInputValidation(message, type = "") {
  inputValidation.textContent = message;
  inputValidation.className = `validation-message ${type}`.trim();
}

function updateInputMeta() {
  const length = input.value.length;
  inputMeta.textContent = length ? `${length.toLocaleString()} characters` : "Paste JSON here";
}

function setFileName(name) {
  if (!name) {
    fileName.hidden = true;
    fileName.textContent = "";
    return;
  }

  fileName.hidden = false;
  fileName.textContent = name;
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

function clearInputErrorMarker() {
  inputHighlight.innerHTML = "";
}

function renderInputErrorMarker(errorInfo) {
  const text = input.value;
  const position = Math.max(0, Math.min(text.length, errorInfo.position));
  const before = escapeHtml(text.slice(0, position));
  const errorChar = escapeHtml(text.slice(position, position + 1) || " ");
  const after = escapeHtml(text.slice(position + 1));

  inputHighlight.innerHTML = `${before}<mark class="input-error-mark">${errorChar}</mark>${after}`;
  inputHighlight.scrollTop = input.scrollTop;
  inputHighlight.scrollLeft = input.scrollLeft;
}

function getIndent() {
  return currentMode === "compact" ? 0 : 2;
}

function stringifyJson(value) {
  return JSON.stringify(value, null, getIndent());
}

function parseJson(text) {
  return JSON.parse(text);
}

function getLineColumnFromPosition(text, position) {
  const beforePosition = text.slice(0, position);
  const lines = beforePosition.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function getJsonStructureIssue(text) {
  const stack = [];
  let inString = false;
  let escaping = false;
  let stringStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') {
      if (!inString) {
        stringStart = index;
      }
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push({ char, position: index });
      continue;
    }

    if (char === "}" || char === "]") {
      const opener = stack.pop();
      const expected = char === "}" ? "{" : "[";
      if (!opener || opener.char !== expected) {
        return {
          position: index,
          message: `Unexpected closing ${char}`
        };
      }
    }
  }

  if (inString) {
    return {
      position: stringStart,
      message: "Unclosed string"
    };
  }

  if (stack.length) {
    const opener = stack[stack.length - 1];
    return {
      position: opener.position,
      message: `Unclosed ${opener.char}`
    };
  }

  return null;
}

function getLikelyJsonIssue(text) {
  const trailingComma = text.match(/,\s*([}\]])/);
  if (trailingComma) {
    return {
      position: trailingComma.index,
      message: `Trailing comma before ${trailingComma[1]}`
    };
  }

  const singleQuotedString = text.match(/'[^'\n\r]*'/);
  if (singleQuotedString) {
    return {
      position: singleQuotedString.index,
      message: "JSON strings must use double quotes"
    };
  }

  const unquotedKey = text.match(/[{,]\s*([A-Za-z_$][\w$-]*)\s*:/);
  if (unquotedKey) {
    return {
      position: unquotedKey.index + unquotedKey[0].indexOf(unquotedKey[1]),
      message: `Object key "${unquotedKey[1]}" must be wrapped in double quotes`
    };
  }

  const missingComma = text.match(/(?:true|false|null|["}\]\d])\s+(?=["{[])/);
  if (missingComma) {
    return {
      position: missingComma.index + missingComma[0].trimEnd().length,
      message: "Missing comma between values"
    };
  }

  return getJsonStructureIssue(text);
}

function parseJsonError(error, text) {
  const positionMatch = error.message.match(/position\s+(\d+)/i);
  const lineColumnMatch = error.message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  const likelyIssue = getLikelyJsonIssue(text);
  const result = {
    message: likelyIssue?.message || error.message,
    position: likelyIssue?.position ?? (positionMatch ? Number(positionMatch[1]) : 0),
    line: lineColumnMatch ? Number(lineColumnMatch[1]) : 1,
    column: lineColumnMatch ? Number(lineColumnMatch[2]) : 1
  };

  if (!lineColumnMatch && (positionMatch || likelyIssue)) {
    Object.assign(result, getLineColumnFromPosition(text, result.position));
  }

  return result;
}

function focusJsonError(errorInfo) {
  const start = Math.max(0, Math.min(input.value.length, errorInfo.position));
  const end = Math.min(input.value.length, start + 1);
  renderInputErrorMarker(errorInfo);
  input.focus();
  input.setSelectionRange(start, end);
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

function syntaxHighlightJson(text) {
  if (!text) {
    return '<span class="output-empty">// Formatted JSON will appear here</span>';
  }

  const tokenPattern = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)|"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:])/g;
  let html = "";
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    const token = match[0];
    html += escapeHtml(text.slice(lastIndex, match.index));
    let className = "token-punctuation";
    if (/^".*"$/.test(token)) {
      className = /"\s*$/.test(token) && text.slice(match.index + token.length).trimStart().startsWith(":") ? "token-key" : "token-string";
    } else if (/^-?\d/.test(token)) {
      className = "token-number";
    } else if (token === "true" || token === "false") {
      className = "token-boolean";
    } else if (token === "null") {
      className = "token-null";
    }

    html += `<span class="${className}">${escapeHtml(token)}</span>`;
    lastIndex = match.index + token.length;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html;
}

function renderSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    output.innerHTML = syntaxHighlightJson(currentText);
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

function primitiveClass(value) {
  if (typeof value === "string") return "tree-string";
  if (typeof value === "number") return "tree-number";
  if (typeof value === "boolean") return "tree-boolean";
  if (value === null) return "tree-null";
  return "tree-muted";
}

function primitiveSearchText(value) {
  return String(value);
}

function highlightIfNeeded(text, search, matched) {
  const escaped = escapeHtml(text);
  if (!matched) return escaped;
  const regex = new RegExp(search.highlightSource, "gi");
  return escaped.replace(regex, (match) => `<mark>${match}</mark>`);
}

function collectContainerPaths(value, path, target) {
  if (!value || typeof value !== "object") return;
  target.add(path);
  const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
  entries.forEach(([childKey, childValue]) => collectContainerPaths(childValue, `${path}.${childKey}`, target));
}

function collectSearchMatches(value, key, path, testRegex, forceOpen) {
  const hasKey = key !== null && key !== undefined;
  let matched = hasKey && testRegex.test(String(key));

  if (value && typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
    let childMatch = false;
    entries.forEach(([childKey, childValue]) => {
      if (collectSearchMatches(childValue, childKey, `${path}.${childKey}`, testRegex, forceOpen)) {
        childMatch = true;
      }
    });
    if (childMatch) {
      forceOpen.add(path);
      matched = true;
    }
  } else if (testRegex.test(primitiveSearchText(value))) {
    matched = true;
  }

  return matched;
}

function renderTreeNode(value, key, path, depth, search) {
  const hasKey = key !== null && key !== undefined;
  const keyStr = hasKey ? String(key) : "";
  const keyMatches = Boolean(hasKey && search && search.test.test(keyStr));
  const keyHtml = hasKey ? `<span class="tree-key">"${highlightIfNeeded(keyStr, search, keyMatches)}"</span><span class="tree-muted">: </span>` : "";
  const margin = depth * 18;

  if (value && typeof value === "object") {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value);
    const openBrace = isArray ? "[" : "{";
    const closeBrace = isArray ? "]" : "}";
    const forcedOpen = Boolean(search && search.forceOpen.has(path));
    const collapsed = collapsedTreePaths.has(path) && !forcedOpen;
    const countLabel = `${entries.length} ${entries.length === 1 ? "item" : "items"}`;
    const matchAttr = keyMatches ? ` data-match-index="${search.counter++}"` : "";
    const toggle = `<span class="tree-toggle">${collapsed ? ">" : "v"}</span>`;
    let html = `<div class="tree-row" data-path="${escapeHtml(path)}" role="button" tabindex="0" aria-expanded="${!collapsed}"${matchAttr} style="margin-left:${margin}px">${toggle}<span>${keyHtml}<span class="tree-punctuation">${openBrace}</span>`;

    if (collapsed) {
      html += `<span class="tree-muted"> ${countLabel} </span><span class="tree-punctuation">${closeBrace}</span></span></div>`;
      return html;
    }

    html += `</span></div>`;
    entries.forEach(([childKey, childValue]) => {
      html += renderTreeNode(childValue, childKey, `${path}.${childKey}`, depth + 1, search);
    });
    html += `<div class="tree-row" style="margin-left:${margin}px"><span class="tree-spacer"></span><span class="tree-punctuation">${closeBrace}</span></div>`;
    return html;
  }

  const valueText = primitiveSearchText(value);
  const valueMatches = Boolean(search && search.test.test(valueText));
  const matchAttr = (keyMatches || valueMatches) ? ` data-match-index="${search.counter++}"` : "";
  const valueHtml = typeof value === "string"
    ? `"${highlightIfNeeded(value, search, valueMatches)}"`
    : highlightIfNeeded(valueText, search, valueMatches);

  return `<div class="tree-row"${matchAttr} style="margin-left:${margin}px"><span class="tree-spacer"></span><span>${keyHtml}<span class="${primitiveClass(value)}">${valueHtml}</span></span></div>`;
}

function updateSearchNav() {
  if (currentMode === "tree" && searchInput.value.trim()) {
    searchCount.textContent = treeMatchCount ? `${treeMatchIndex + 1} of ${treeMatchCount}` : "0 matches";
  }
  searchPrevBtn.disabled = treeMatchCount === 0;
  searchNextBtn.disabled = treeMatchCount === 0;
}

function focusTreeMatch() {
  treeOutput.querySelectorAll(".current-match").forEach((row) => row.classList.remove("current-match"));
  if (treeMatchIndex < 0) return;

  const row = treeOutput.querySelector(`[data-match-index="${treeMatchIndex}"]`);
  if (row) {
    row.classList.add("current-match");
    row.scrollIntoView({ block: "center" });
  }
}

function stepTreeMatch(delta) {
  if (treeMatchCount === 0) return;
  treeMatchIndex = (treeMatchIndex + delta + treeMatchCount) % treeMatchCount;
  updateSearchNav();
  focusTreeMatch();
}

function renderTree() {
  if (!lastJsonValue) {
    treeOutput.innerHTML = '<span class="output-empty">// Format valid JSON to see the tree</span>';
    treeMatchCount = 0;
    treeMatchIndex = -1;
    updateSearchNav();
    return;
  }

  const query = searchInput.value.trim();
  let search = null;

  if (query) {
    const testRegex = new RegExp(escapeRegExp(query), "i");
    const forceOpen = new Set();
    collectSearchMatches(lastJsonValue, null, "root", testRegex, forceOpen);
    search = { test: testRegex, highlightSource: escapeRegExp(query), forceOpen, counter: 0 };
  }

  treeOutput.innerHTML = renderTreeNode(lastJsonValue, null, "root", 0, search);
  treeMatchCount = search ? search.counter : 0;

  if (treeMatchCount === 0) {
    treeMatchIndex = -1;
  } else if (treeMatchIndex < 0 || treeMatchIndex >= treeMatchCount) {
    treeMatchIndex = 0;
  }

  updateSearchNav();
  if (query) focusTreeMatch();
}

function toggleTreePath(path) {
  if (collapsedTreePaths.has(path)) {
    collapsedTreePaths.delete(path);
  } else {
    collapsedTreePaths.add(path);
  }
  renderTree();
}

function updateOutput(text) {
  currentText = text;
  outputMeta.textContent = text ? `${text.length.toLocaleString()} characters` : "No output yet";

  const isTree = currentMode === "tree";
  treeActions.hidden = !isTree;
  searchPrevBtn.hidden = !isTree;
  searchNextBtn.hidden = !isTree;

  if (isTree) {
    outputPre.hidden = true;
    treeOutput.hidden = false;
    renderTree();
    return;
  }

  outputPre.hidden = false;
  treeOutput.hidden = true;
  renderSearch();
}

function validateInput({ focusError = true } = {}) {
  const raw = input.value;
  updateInputMeta();

  if (!raw.trim()) {
    setInputValidation(EMPTY_INPUT_MESSAGE);
    return null;
  }

  try {
    const value = parseJson(raw);
    clearInputErrorMarker();
    setInputValidation(VALID_INPUT_MESSAGE, "valid");
    return value;
  } catch (error) {
    const errorInfo = parseJsonError(error, raw);
    setInputValidation(`Line ${errorInfo.line}, column ${errorInfo.column}: ${errorInfo.message}`, "invalid");
    if (focusError) {
      focusJsonError(errorInfo);
    }
    return null;
  }
}

function formatJson({ repair = false } = {}) {
  const raw = input.value;
  updateInputMeta();

  if (!raw.trim()) {
    lastJsonValue = null;
    updateOutput("");
    setStatus("Paste JSON to get started");
    setInputValidation(EMPTY_INPUT_MESSAGE);
    return;
  }

  try {
    const source = repair ? repairJsonText(raw) : raw;
    const value = parseJson(source);
    lastJsonValue = value;
    clearInputErrorMarker();
    collapsedTreePaths.clear();
    updateOutput(stringifyJson(value));
    setStatus(repair ? "JSON repaired and formatted" : "Valid JSON formatted", repair ? "repaired" : "valid");
    setInputValidation(repair ? "Input repaired successfully. Review output before copying." : VALID_INPUT_MESSAGE, repair ? "repaired" : "valid");
  } catch (error) {
    const checkedSource = repair ? repairJsonText(raw) : raw;
    const errorInfo = parseJsonError(error, checkedSource);
    lastJsonValue = null;
    updateOutput("");
    setStatus(`Invalid JSON: ${errorInfo.message}`, "invalid");
    setInputValidation(`Line ${errorInfo.line}, column ${errorInfo.column}: ${errorInfo.message}`, "invalid");
    focusJsonError(errorInfo);
  }
}

async function loadFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    input.value = text;
    setFileName(file.name);
    lastJsonValue = null;
    clearInputErrorMarker();
    updateInputMeta();
    setInputValidation("File loaded. Validate or format to check it.");
    setStatus("File loaded");
    input.focus();
  } catch {
    setStatus("Could not read file", "invalid");
  }
}

function downloadOutput() {
  if (!currentText) {
    setStatus("Nothing to download");
    return;
  }

  const blob = new Blob([currentText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "formatted.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("Download ready", "valid");
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));

    if (lastJsonValue === null && input.value.trim()) {
      formatJson();
      return;
    }

    updateOutput(lastJsonValue ? stringifyJson(lastJsonValue) : currentText);
  });
});

formatBtn.addEventListener("click", () => formatJson());
repairBtn.addEventListener("click", () => formatJson({ repair: true }));
validateBtn.addEventListener("click", () => validateInput());
searchInput.addEventListener("input", () => {
  if (currentMode === "tree") {
    renderTree();
  } else {
    renderSearch();
  }
});
searchPrevBtn.addEventListener("click", () => stepTreeMatch(-1));
searchNextBtn.addEventListener("click", () => stepTreeMatch(1));
expandAllBtn.addEventListener("click", () => {
  collapsedTreePaths.clear();
  renderTree();
});
collapseAllBtn.addEventListener("click", () => {
  collapsedTreePaths.clear();
  collectContainerPaths(lastJsonValue, "root", collapsedTreePaths);
  renderTree();
});
downloadBtn.addEventListener("click", downloadOutput);
fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));

input.addEventListener("input", () => {
  lastJsonValue = null;
  clearInputErrorMarker();
  updateInputMeta();
  setInputValidation("Input changed. Validate again to check for errors.");
});

input.addEventListener("scroll", () => {
  inputHighlight.scrollTop = input.scrollTop;
  inputHighlight.scrollLeft = input.scrollLeft;
});

inputEditor.addEventListener("dragover", (event) => {
  event.preventDefault();
  inputEditor.classList.add("drag-over");
});

inputEditor.addEventListener("dragleave", () => {
  inputEditor.classList.remove("drag-over");
});

inputEditor.addEventListener("drop", (event) => {
  event.preventDefault();
  inputEditor.classList.remove("drag-over");
  loadFile(event.dataTransfer.files[0]);
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  fileInput.value = "";
  setFileName("");
  lastJsonValue = null;
  clearInputErrorMarker();
  updateOutput("");
  updateInputMeta();
  setInputValidation(EMPTY_INPUT_MESSAGE);
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

treeOutput.addEventListener("click", (event) => {
  const row = event.target.closest("[data-path]");
  if (!row) return;
  toggleTreePath(row.dataset.path);
});

treeOutput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-path]");
  if (!row) return;
  event.preventDefault();
  toggleTreePath(row.dataset.path);
});

updateInputMeta();
updateOutput("");
setStatus("Paste JSON to get started");
