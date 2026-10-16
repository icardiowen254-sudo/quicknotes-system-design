const API_URL = "https://jsonplaceholder.typicode.com/posts";
const loadButton = document.querySelector("#load-btn");
const statusMessage = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitButton = document.querySelector("#submit-btn");

let notes = [];
let nextLocalId = -1;

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status";
  if (type) statusMessage.classList.add(type);
}

// Shared fetch helper: callers handle request-specific messages and recovery.
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return { data: null, status: response.status };
  const data = await response.json();
  return { data, status: response.status };
}

function renderNotes(items) {
  notesList.replaceChildren();
  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No notes to show yet. Load notes or create your first note.";
    notesList.append(emptyItem);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((note) => {
    const item = document.createElement("li");
    item.className = "note-card";

    const top = document.createElement("div");
    top.className = "note-top";
    const textGroup = document.createElement("div");
    const id = document.createElement("p");
    id.className = "note-id";
    id.textContent = `Note ID: ${note.id}`;
    const title = document.createElement("h3");
    title.textContent = note.title || "Untitled note";
    const body = document.createElement("p");
    body.textContent = note.body || "No body provided.";
    textGroup.append(id, title, body);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteNote(note, deleteButton));
    top.append(textGroup, deleteButton);
    item.append(top);
    fragment.append(item);
  });
  notesList.append(fragment);
}

async function loadNotes() {
  loadButton.disabled = true;
  setStatus("Loading notes...");
  try {
    const { data } = await request(`${API_URL}?_limit=10`);
    if (!Array.isArray(data)) throw new Error("The server returned an unexpected response.");
    notes = data;
    renderNotes(notes);
    if (notes.length === 0) {
      setStatus("The server returned no notes.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    notes = [];
    renderNotes(notes);
    setStatus(`Couldn't load notes. ${error.message || "Please try again."}`, "error");
  } finally {
    loadButton.disabled = false;
  }
}

async function createNote(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title) {
    setStatus("Please enter a title before creating a note.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  submitButton.disabled = true;
  setStatus("Creating note...");
  try {
    const { data, status } = await request(API_URL, {
      method: "POST",
      body: JSON.stringify({ title, body, userId: 1 })
    });
    // JSONPlaceholder simulates POST and usually returns id 101, but does not persist it.
    // Keep a local copy in this page so the demo remains useful until it is reloaded.
    const localNote = { ...data, id: data.id, localKey: nextLocalId--, apiId: data.id, title, body, userId: 1, isLocalDemo: true };
    notes = [localNote, ...notes];
    renderNotes(notes);
    setStatus(`Note created (status ${status}, id ${data.id}). This demo note is only kept in this page.`, "success");
    noteForm.reset();
  } catch (error) {
    setStatus(`Couldn't create the note. ${error.message || "Please try again."}`, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteNote(note, button) {
  if (!notes.includes(note)) return;
  button.disabled = true;
  setStatus("Deleting note...");
  try {
    // JSONPlaceholder returns success for DELETE but does not persist deletions.
    // Remove the note locally only after the simulated API request succeeds.
    await request(`${API_URL}/${encodeURIComponent(note.apiId ?? note.id)}`, { method: "DELETE" });
    notes = notes.filter((item) => item !== note);
    renderNotes(notes);
    setStatus("Note deleted from this page.", "success");
  } catch (error) {
    button.disabled = false;
    setStatus(`Couldn't delete the note. ${error.message || "Please try again."}`, "error");
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
