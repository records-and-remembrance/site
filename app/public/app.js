const state = { drafts: [], current: null, dirty: false };
const $ = (id) => document.getElementById(id);

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "request failed");
  return data;
}

function matches(draft) {
  const q = $("search").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  if (status && draft.status !== status) return false;
  if (!q) return true;
  return (draft.canonicalTitle + " " + draft.file).toLowerCase().includes(q);
}

function renderList() {
  const list = $("list");
  const filtered = state.drafts.filter(matches);
  list.innerHTML = "";
  $("stats").textContent = `${filtered.length} / ${state.drafts.length} drafts`;

  for (const draft of filtered) {
    const button = document.createElement("button");
    button.className = `item${state.current?.file === draft.file ? " active" : ""}`;
    button.innerHTML = [
      '<div class="item-title"></div>',
      '<div class="item-meta">',
      `<span class="badge ${draft.status}">${draft.status}</span>`,
      `<span class="badge">${draft.sourceCount} sources</span>`,
      `<span class="badge">${draft.releaseCount} rel</span>`,
      `<span class="badge">${draft.liveCount} live</span>`,
      "</div>",
    ].join("");
    button.querySelector(".item-title").textContent = draft.canonicalTitle;
    button.addEventListener("click", () => loadDraft(draft.file));
    list.append(button);
  }
}

function setMessage(value) {
  $("message").textContent = value;
}

function collectPayload() {
  return {
    canonicalTitle: $("canonicalTitle").value,
    status: $("status").value,
    compositionId: $("compositionId").value.trim() || null,
    aliases: $("aliases").value.split("\n").map((line) => line.trim()).filter(Boolean),
    body: $("body").value,
  };
}

async function loadDraft(file) {
  if (state.dirty && !confirm("You have unsaved changes. Discard them?")) return;

  const draft = await api(`/api/drafts/${encodeURIComponent(file)}`);
  state.current = draft;
  state.dirty = false;
  $("empty").hidden = true;
  $("editor").hidden = false;
  $("fileName").textContent = draft.file;
  $("editorTitle").textContent = draft.canonicalTitle;
  $("canonicalTitle").value = draft.canonicalTitle;
  $("status").value = draft.status;
  $("compositionId").value = draft.compositionId || "";
  $("aliases").value = draft.aliases.join("\n");
  $("body").value = draft.body;
  $("sources").textContent = draft.sourcesYaml;
  setMessage("");
  renderList();
}

async function save() {
  if (!state.current) return;

  $("save").disabled = true;
  setMessage("Saving...");
  try {
    const saved = await api(`/api/drafts/${encodeURIComponent(state.current.file)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(collectPayload()),
    });
    state.current = saved;
    state.dirty = false;
    setMessage("Saved");
    await loadList(saved.file);
  } catch (error) {
    setMessage(error.message);
  } finally {
    $("save").disabled = false;
  }
}

async function loadList(preselectFile) {
  state.drafts = await api("/api/drafts");
  renderList();
  if (preselectFile) {
    state.current = { ...state.current, file: preselectFile };
    renderList();
  }
}

$("search").addEventListener("input", renderList);
$("statusFilter").addEventListener("change", renderList);
$("save").addEventListener("click", save);
$("markReviewed").addEventListener("click", () => {
  $("status").value = "reviewed";
  state.dirty = true;
  save();
});

for (const id of ["canonicalTitle", "status", "compositionId", "aliases", "body"]) {
  $(id).addEventListener("input", () => {
    state.dirty = true;
    setMessage("Unsaved");
  });
  $(id).addEventListener("change", () => {
    state.dirty = true;
    setMessage("Unsaved");
  });
}

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

loadList().catch((error) => {
  $("stats").textContent = error.message;
});
