const STORAGE_KEY = "inkflow-notes-v1";

const state = {
  notes: JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"),
  activeNoteId: null,
  tool: "calligraphy",
  color: "#1d1d1f",
  size: 6,
  view: "home",
  wallpaperPreset: "paper",
  menuTheme: "paper",
};

let drawing = false;
let currentStroke = null;
let draggingTextboxId = null;
let dragOffset = { x: 0, y: 0 };

const noteListEl = document.getElementById("noteList");
const currentNoteTitleEl = document.getElementById("currentNoteTitle");
const drawingCanvas = document.getElementById("drawingCanvas");
const canvasCtx = drawingCanvas.getContext("2d");
const boardEl = document.getElementById("board");
const textBoxLayer = document.getElementById("textboxLayer");
const wallpaperFrame = document.getElementById("wallpaperFrame");
const wallpaperImageLayer = document.getElementById("wallpaperImageLayer");
const wallpaperVideo = document.getElementById("wallpaperVideo");

function uid() {
  return crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultNote() {
  return {
    id: uid(),
    title: "Untitled note",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    strokes: [],
    textBoxes: [],
    paperTint: "#fffdfb",
  };
}

function getActiveNote() {
  if (!state.activeNoteId) {
    if (state.notes.length > 0) {
      state.activeNoteId = state.notes[0].id;
    } else {
      const newNote = createDefaultNote();
      state.notes.push(newNote);
      state.activeNoteId = newNote.id;
    }
  }

  return state.notes.find((note) => note.id === state.activeNoteId) || null;
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
}

function getNoteDate(note) {
  return new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function setView(viewName) {
  state.view = viewName;

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  document.querySelectorAll(".screen-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${viewName}Screen`);
  });
}

function renderNoteList() {
  noteListEl.innerHTML = "";

  if (state.notes.length === 0) {
    noteListEl.innerHTML = '<p class="empty-state">No notes yet.</p>';
    return;
  }

  state.notes.forEach((note) => {
    const item = document.createElement("div");
    item.className = `note-card ${note.id === state.activeNoteId ? "active" : ""}`;
    item.innerHTML = `
      <div class="note-meta">
        <h4>${escapeHtml(note.title || "Untitled note")}</h4>
        <p>${getNoteDate(note)}</p>
      </div>
      <span class="note-color" aria-hidden="true"></span>
    `;

    item.addEventListener("click", () => {
      state.activeNoteId = note.id;
      render();
    });

    noteListEl.appendChild(item);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderCanvas() {
  const note = getActiveNote();
  if (!note) return;

  canvasCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  canvasCtx.fillStyle = note.paperTint || "#fffdfb";
  canvasCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);

  note.strokes.forEach((stroke) => renderStroke(stroke));
}

function renderStroke(stroke) {
  if (!stroke || !stroke.points || stroke.points.length === 0) return;

  canvasCtx.save();
  canvasCtx.lineCap = "round";
  canvasCtx.lineJoin = "round";

  if (stroke.tool === "eraser") {
    canvasCtx.globalCompositeOperation = "destination-out";
    canvasCtx.strokeStyle = "rgba(0,0,0,1)";
    canvasCtx.lineWidth = stroke.size * 2.2;
  } else {
    canvasCtx.globalCompositeOperation = "source-over";
    canvasCtx.strokeStyle = stroke.color || state.color;
    canvasCtx.lineWidth = stroke.size || state.size;
  }

  if (stroke.tool === "calligraphy") {
    for (let i = 1; i < stroke.points.length; i += 1) {
      const prev = stroke.points[i - 1];
      const curr = stroke.points[i];
      const variation = stroke.size * (0.75 + (i / stroke.points.length) * 1.5);
      canvasCtx.lineWidth = variation;
      canvasCtx.beginPath();
      canvasCtx.moveTo(prev.x, prev.y);
      canvasCtx.lineTo(curr.x, curr.y);
      canvasCtx.stroke();
    }
  } else if (stroke.tool === "ballpoint") {
    canvasCtx.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) {
        canvasCtx.moveTo(point.x, point.y);
      } else {
        canvasCtx.lineTo(point.x, point.y);
      }
    });
    canvasCtx.stroke();
  } else {
    canvasCtx.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) {
        canvasCtx.moveTo(point.x, point.y);
      } else {
        canvasCtx.lineTo(point.x, point.y);
      }
    });
    canvasCtx.stroke();
  }

  canvasCtx.restore();
}

function renderTextBoxes() {
  const note = getActiveNote();
  if (!note) return;

  textBoxLayer.innerHTML = "";

  note.textBoxes.forEach((box) => {
    const textarea = document.createElement("textarea");
    textarea.className = "note-textbox";
    textarea.value = box.text;
    textarea.style.left = `${box.x}px`;
    textarea.style.top = `${box.y}px`;
    textarea.style.width = `${box.width || 220}px`;
    textarea.style.height = `${box.height || 52}px`;
    textarea.style.fontSize = `${box.fontSize || 24}px`;
    textarea.style.fontFamily = box.fontFamily || '"Patrick Hand", cursive';
    textarea.style.transform = `rotate(${box.rotate || 0}deg)`;
    textarea.style.background = box.background || "rgba(255,255,255,0.1)";
    textarea.style.color = box.color || "#151515";

    textarea.addEventListener("input", (event) => {
      box.text = event.target.value;
      note.updatedAt = Date.now();
      saveNotes();
    });

    textarea.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      beginTextboxDrag(event, box.id, textarea);
    });

    textarea.addEventListener("touchstart", (event) => {
      event.stopPropagation();
      beginTextboxDrag(event.touches[0], box.id, textarea);
    }, { passive: false });

    textBoxLayer.appendChild(textarea);
  });
}

function beginTextboxDrag(event, boxId, element) {
  const note = getActiveNote();
  if (!note) return;
  const box = note.textBoxes.find((item) => item.id === boxId);
  if (!box) return;

  draggingTextboxId = boxId;
  const boardRect = boardEl.getBoundingClientRect();
  const point = {
    x: event.clientX - boardRect.left,
    y: event.clientY - boardRect.top,
  };

  dragOffset = {
    x: point.x - box.x,
    y: point.y - box.y,
  };

  element.setPointerCapture?.(event.pointerId);
  element.style.zIndex = "20";
}

function handleTextboxDrag(event) {
  if (!draggingTextboxId) return;

  const note = getActiveNote();
  if (!note) return;

  const box = note.textBoxes.find((item) => item.id === draggingTextboxId);
  if (!box) return;

  const rect = boardEl.getBoundingClientRect();
  const point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  box.x = Math.max(0, point.x - dragOffset.x);
  box.y = Math.max(0, point.y - dragOffset.y);
  note.updatedAt = Date.now();
  renderTextBoxes();
  saveNotes();
}

function stopTextboxDrag() {
  draggingTextboxId = null;
  dragOffset = { x: 0, y: 0 };
}

function renderNoteContent() {
  const note = getActiveNote();
  if (!note) return;

  currentNoteTitleEl.textContent = note.title || "Untitled note";
  renderCanvas();
  renderTextBoxes();
}

function render() {
  if (!state.notes.length) {
    const newNote = createDefaultNote();
    state.notes.push(newNote);
    state.activeNoteId = newNote.id;
  }

  renderNoteList();
  renderNoteContent();
  document.getElementById("colorPicker").value = state.color;
  document.getElementById("sizeSlider").value = state.size;
  document.querySelectorAll(".tool-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === state.tool);
  });
  setView(state.view);
  renderWallpaper();
}

function setNoteTitle(value) {
  const note = getActiveNote();
  if (!note) return;
  note.title = value.trim() || "Untitled note";
  note.updatedAt = Date.now();
  saveNotes();
  renderNoteList();
  renderNoteContent();
}

function addNote() {
  const note = createDefaultNote();
  state.notes.unshift(note);
  state.activeNoteId = note.id;
  saveNotes();
  render();
}

function getBoardPoint(event) {
  const rect = boardEl.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
  };
}

function pointerDown(event) {
  if (draggingTextboxId) {
    return;
  }

  if (["eraser", "calligraphy", "ballpoint"].includes(state.tool)) {
    const note = getActiveNote();
    if (!note) return;

    const point = getBoardPoint(event);
    currentStroke = {
      id: uid(),
      tool: state.tool,
      color: state.color,
      size: state.size,
      points: [point],
    };
    note.strokes.push(currentStroke);
    note.updatedAt = Date.now();
    drawing = true;
    renderCanvas();
  }
}

function pointerMove(event) {
  if (draggingTextboxId) {
    handleTextboxDrag(event);
    return;
  }

  if (!drawing || !currentStroke) return;

  const note = getActiveNote();
  if (!note) return;

  const point = getBoardPoint(event);
  currentStroke.points.push(point);
  note.updatedAt = Date.now();
  renderCanvas();
}

function pointerUp() {
  if (draggingTextboxId) {
    stopTextboxDrag();
    return;
  }

  drawing = false;
  currentStroke = null;
  saveNotes();
}

function addTextBox() {
  const note = getActiveNote();
  if (!note) return;

  note.textBoxes.push({
    id: uid(),
    x: 160 + (note.textBoxes.length * 18) % 300,
    y: 120 + (note.textBoxes.length * 30) % 220,
    width: 220,
    height: 52,
    text: "Type here",
    fontSize: 24,
    fontFamily: '"Patrick Hand", cursive',
    rotate: 0,
    background: "rgba(255,255,255,0.08)",
    color: "#18181a",
  });

  note.updatedAt = Date.now();
  saveNotes();
  renderNoteContent();
}

function exportAsPdf() {
  const { jsPDF } = window.jspdf;
  const note = getActiveNote();
  if (!note) return;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = drawingCanvas.width;
  exportCanvas.height = drawingCanvas.height;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.fillStyle = note.paperTint || "#fffdfb";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  note.strokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;

    exportCtx.save();
    exportCtx.lineCap = "round";
    exportCtx.lineJoin = "round";

    if (stroke.tool === "eraser") {
      exportCtx.globalCompositeOperation = "destination-out";
      exportCtx.strokeStyle = "rgba(0,0,0,1)";
      exportCtx.lineWidth = stroke.size * 2.2;
    } else {
      exportCtx.globalCompositeOperation = "source-over";
      exportCtx.strokeStyle = stroke.color || state.color;
      exportCtx.lineWidth = stroke.size || state.size;
    }

    if (stroke.tool === "calligraphy") {
      for (let i = 1; i < stroke.points.length; i += 1) {
        const prev = stroke.points[i - 1];
        const curr = stroke.points[i];
        const weight = stroke.size * (0.7 + (i / stroke.points.length) * 1.8);
        exportCtx.lineWidth = weight;
        exportCtx.beginPath();
        exportCtx.moveTo(prev.x, prev.y);
        exportCtx.lineTo(curr.x, curr.y);
        exportCtx.stroke();
      }
    } else {
      exportCtx.beginPath();
      stroke.points.forEach((point, index) => {
        if (index === 0) {
          exportCtx.moveTo(point.x, point.y);
        } else {
          exportCtx.lineTo(point.x, point.y);
        }
      });
      exportCtx.stroke();
    }

    exportCtx.restore();
  });

  note.textBoxes.forEach((box) => {
    exportCtx.save();
    exportCtx.translate(box.x, box.y);
    exportCtx.rotate((box.rotate || 0) * (Math.PI / 180));
    exportCtx.font = `${box.fontSize || 24}px ${box.fontFamily || '"Patrick Hand", cursive'}`;
    exportCtx.fillStyle = box.color || "#121212";
    exportCtx.fillText(box.text || "", 0, 30);
    exportCtx.restore();
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const dataUrl = exportCanvas.toDataURL("image/png");
  const imgWidth = 520;
  const imgHeight = (exportCanvas.height * imgWidth) / exportCanvas.width;
  const x = (pageWidth - imgWidth) / 2;
  const y = (pageHeight - imgHeight) / 2;

  pdf.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight);
  pdf.save(`${(note.title || "note").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

function renderWallpaper() {
  const presetMap = {
    paper: "linear-gradient(135deg, rgba(255,255,255,0.8), rgba(206,195,179,0.55))",
    forest: "linear-gradient(135deg, rgba(16,57,47,0.8), rgba(35,104,88,0.6))",
    night: "linear-gradient(135deg, rgba(18,21,35,0.85), rgba(42,58,92,0.72))",
    sunset: "linear-gradient(135deg, rgba(127,55,46,0.7), rgba(217,144,100,0.55))",
  };

  const chosen = presetMap[state.wallpaperPreset] || presetMap.paper;
  wallpaperFrame.style.background = chosen;
  wallpaperFrame.style.boxShadow = "0 18px 32px rgba(15, 14, 14, 0.14)";

  document.querySelectorAll(".preset-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.wallpaperPreset);
  });

  const themeMap = {
    paper: "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(219,208,194,0.7))",
    midnight: "linear-gradient(135deg, rgba(20,25,36,0.82), rgba(58,73,93,0.74))",
    forest: "linear-gradient(135deg, rgba(13,30,24,0.76), rgba(36,73,56,0.75))",
  };

  const menuCard = document.querySelector(".menu-card");
  if (menuCard) {
    menuCard.style.background = themeMap[state.menuTheme] || themeMap.paper;
  }

  document.querySelectorAll(".menu-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.menuTheme === state.menuTheme);
  });
}

function loadWallpaperFromFile(file, kind) {
  const reader = new FileReader();
  reader.onload = () => {
    if (kind === "image") {
      wallpaperImageLayer.style.display = "block";
      wallpaperVideo.style.display = "none";
      wallpaperImageLayer.style.backgroundImage = `url(${reader.result})`;
    }

    if (kind === "video") {
      wallpaperVideo.src = reader.result;
      wallpaperVideo.style.display = "block";
      wallpaperImageLayer.style.display = "none";
      wallpaperVideo.play().catch(() => {});
    }
  };
  reader.readAsDataURL(file);
}

function bindEvents() {
  document.getElementById("newNoteBtn").addEventListener("click", addNote);
  document.getElementById("saveNoteBtn").addEventListener("click", saveNotes);
  document.getElementById("addTextBtn").addEventListener("click", addTextBox);
  document.getElementById("exportPdfBtn").addEventListener("click", exportAsPdf);

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll(".tool-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      render();
    });
  });

  document.getElementById("sizeSlider").addEventListener("input", (event) => {
    state.size = Number(event.target.value);
  });

  document.getElementById("colorPicker").addEventListener("input", (event) => {
    state.color = event.target.value;
  });

  document.querySelectorAll(".preset-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.wallpaperPreset = button.dataset.preset;
      renderWallpaper();
    });
  });

  document.querySelectorAll(".menu-choice").forEach((button) => {
    button.addEventListener("click", () => {
      state.menuTheme = button.dataset.menuTheme;
      renderWallpaper();
    });
  });

  document.getElementById("imageUpload").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadWallpaperFromFile(file, "image");
  });

  document.getElementById("videoUpload").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadWallpaperFromFile(file, "video");
  });

  boardEl.addEventListener("pointerdown", pointerDown);
  boardEl.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointerleave", pointerUp);

  currentNoteTitleEl.addEventListener("dblclick", () => {
    const note = getActiveNote();
    if (!note) return;
    const next = window.prompt("Rename this note", note.title || "Untitled note");
    if (next !== null) {
      setNoteTitle(next);
    }
  });
}

bindEvents();
render();
