const API_BASE = "https://backendmastervector-production.up.railway.app";

const stateNodes = {
  upload: document.getElementById("uploadState"),
  progress: document.getElementById("progressState"),
  logs: document.getElementById("logsState"),
  done: document.getElementById("doneState"),
};

const fileInput = document.getElementById("bmpFile");
const settingsJson = document.getElementById("settingsJson");
const settingMethod = document.getElementById("settingMethod");
const settingPreScaleFactor = document.getElementById("settingPreScaleFactor");
const settingMinArea = document.getElementById("settingMinArea");
const settingConnectRadius = document.getElementById("settingConnectRadius");
const settingConnectOp = document.getElementById("settingConnectOp");
const settingCollinearTol = document.getElementById("settingCollinearTol");
const settingIgnoreBackground = document.getElementById("settingIgnoreBackground");
const settingDrawBackground = document.getElementById("settingDrawBackground");
const settingConnectSameColor = document.getElementById("settingConnectSameColor");
const settingConnect4Neighbors = document.getElementById("settingConnect4Neighbors");
const settingSimplifyCollinear = document.getElementById("settingSimplifyCollinear");
const formError = document.getElementById("formError");
const startJobBtn = document.getElementById("startJobBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const userInfo = document.getElementById("userInfo");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const logsOutput = document.getElementById("logsOutput");
const jobsList = document.getElementById("jobsList");
const downloadSvgBtn = document.getElementById("downloadSvgBtn");
const downloadLogBtn = document.getElementById("downloadLogBtn");
const restartBtn = document.getElementById("restartBtn");
const resetDefaultsBtn = document.getElementById("resetDefaultsBtn");

// AI-панель
const aiSuggestBtn = document.getElementById("aiSuggestBtn");
const aiProgress   = document.getElementById("aiProgress");
const aiProgressBar   = document.getElementById("aiProgressBar");
const aiProgressStage = document.getElementById("aiProgressStage");
const aiProgressPct   = document.getElementById("aiProgressPct");
const aiProgressLog   = document.getElementById("aiProgressLog");
const aiError = document.getElementById("aiError");
const aiResult = document.getElementById("aiResult");
const aiExplanation = document.getElementById("aiExplanation");
const aiSettingsPreview = document.getElementById("aiSettingsPreview");
const aiApplyBtn = document.getElementById("aiApplyBtn");
const aiModelLabel = document.getElementById("aiModelLabel");

// AI-чат
const aiChat = document.getElementById("aiChat");
const aiChatMessages = document.getElementById("aiChatMessages");
const aiChatInput = document.getElementById("aiChatInput");
const aiChatSendBtn = document.getElementById("aiChatSendBtn");
const aiChatClearBtn = document.getElementById("aiChatClearBtn");
const aiChatError = document.getElementById("aiChatError");

let _aiSuggestedSettings = null;
let _aiChatHistory = [];   // [{role, content}]
let _aiImageMetrics = null; // метрики последнего изображения

let currentJobId = null;
let pollTimer = null;
let isGuestMode = false;

function getGuestToken() {
  return sessionStorage.getItem("guest_token");
}

function ensureGuestToken() {
  let token = getGuestToken();
  if (!token) {
    token = (self.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g, "");
    sessionStorage.setItem("guest_token", token);
  }
  return token;
}

function setGuestToken(token) {
  if (token) {
    sessionStorage.setItem("guest_token", token);
  }
}

function getAccessToken() {
  return localStorage.getItem("access_token");
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

function saveTokens(data) {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_email");
}

function showState(name) {
  Object.values(stateNodes).forEach((node) => node.classList.remove("visible"));
  stateNodes[name].classList.add("visible");
}

function setProgress(value) {
  const safe = Math.max(0, Math.min(100, value));
  progressBar.style.width = `${safe}%`;
  progressPercent.textContent = `${safe}%`;
}

function setError(message) {
  formError.textContent = message || "";
}

function readNumber(node, fieldName) {
  const value = Number(node.value);
  if (!Number.isFinite(value)) {
    throw new Error(`Поле ${fieldName} должно быть числом`);
  }
  return value;
}

function collectSettings() {
  const settings = {
    method: settingMethod.value,
    pre_scale_factor: readNumber(settingPreScaleFactor, "pre_scale_factor"),
    min_area: Math.max(1, Math.floor(readNumber(settingMinArea, "min_area"))),
    connect_radius_px: Math.max(0, readNumber(settingConnectRadius, "connect_radius_px")),
    connect_op: settingConnectOp.value,
    collinear_tol: Math.max(0, readNumber(settingCollinearTol, "collinear_tol")),
    ignore_background: settingIgnoreBackground.checked,
    draw_background: settingDrawBackground.checked,
    connect_same_color: settingConnectSameColor.checked,
    connect_4neighbors: settingConnect4Neighbors.checked,
    simplify_collinear: settingSimplifyCollinear.checked,
  };

  const rawSettings = settingsJson.value.trim();
  if (!rawSettings) {
    return settings;
  }

  let overrides;
  try {
    overrides = JSON.parse(rawSettings);
  } catch (error) {
    throw new Error(`Некорректный JSON настроек: ${error.message}`);
  }

  if (typeof overrides !== "object" || Array.isArray(overrides) || overrides === null) {
    throw new Error("Дополнительные настройки должны быть JSON-объектом");
  }

  return { ...settings, ...overrides };
}

const DEFAULT_SETTINGS = {
  method: "rle",
  pre_scale_factor: 3,
  min_area: 1,
  connect_radius_px: 1,
  connect_op: "dilate",
  collinear_tol: 0,
  ignore_background: true,
  draw_background: true,
  connect_same_color: true,
  connect_4neighbors: true,
  simplify_collinear: true,
};

function resetSettingsToDefaults() {
  settingMethod.value = DEFAULT_SETTINGS.method;
  settingPreScaleFactor.value = String(DEFAULT_SETTINGS.pre_scale_factor);
  settingMinArea.value = String(DEFAULT_SETTINGS.min_area);
  settingConnectRadius.value = String(DEFAULT_SETTINGS.connect_radius_px);
  settingConnectOp.value = DEFAULT_SETTINGS.connect_op;
  settingCollinearTol.value = String(DEFAULT_SETTINGS.collinear_tol);
  settingIgnoreBackground.checked = DEFAULT_SETTINGS.ignore_background;
  settingDrawBackground.checked = DEFAULT_SETTINGS.draw_background;
  settingConnectSameColor.checked = DEFAULT_SETTINGS.connect_same_color;
  settingConnect4Neighbors.checked = DEFAULT_SETTINGS.connect_4neighbors;
  settingSimplifyCollinear.checked = DEFAULT_SETTINGS.simplify_collinear;
  settingsJson.value = "";
  _aiSuggestedSettings = null;
}

// ─── AI-ассистент ────────────────────────────────────────────

const AI_STAGES = [
  { pct: 8,  icon: "📤", text: "Подготовка изображения..." },
  { pct: 20, icon: "🔍", text: "Анализ метрик изображения..." },
  { pct: 30, icon: "🚀", text: "Отправка запроса в Ollama..." },
  { pct: 40, icon: "⚙️",  text: "Загрузка модели в память..." },
  { pct: 88, icon: "🤖", text: "Генерация рекомендаций..." },
  { pct: 95, icon: "📊", text: "Обработка ответа..." },
  { pct: 100, icon: "✅", text: "Готово!" },
];

let _aiTickTimer = null;

function _clearAITick() {
  if (_aiTickTimer) { clearInterval(_aiTickTimer); _aiTickTimer = null; }
}

function _setProgress(pct, stageText) {
  if (pct !== undefined) {
    aiProgressBar.style.width = `${pct}%`;
    aiProgressPct.textContent = `${pct}%`;
  }
  if (stageText) aiProgressStage.textContent = stageText;
}

function _addLogEntry(icon, text, type = "info") {
  const li = document.createElement("li");
  li.className = `ai-log-entry ai-log-${type}`;
  li.textContent = `${icon} ${text}`;
  aiProgressLog.appendChild(li);
  aiProgressLog.scrollTop = aiProgressLog.scrollHeight;
}

function _startSlowTick(fromPct, toPct) {
  _clearAITick();
  let current = fromPct;
  _aiTickTimer = setInterval(() => {
    if (current < toPct) {
      current++;
      aiProgressBar.style.width = `${current}%`;
      aiProgressPct.textContent = `${current}%`;
    }
  }, 800);
}

function setAIState(state) {
  aiProgress.classList.add("hidden");
  aiError.classList.add("hidden");
  aiResult.classList.add("hidden");

  if (state === "loading") {
    aiProgressLog.innerHTML = "";
    _setProgress(0, "Подготовка...");
    aiProgress.classList.remove("hidden");
  } else if (state === "error") {
    _clearAITick();
    aiError.classList.remove("hidden");
  } else if (state === "result") {
    _clearAITick();
    aiResult.classList.remove("hidden");
  }
}

async function askAI() {
  const file = fileInput.files?.[0];
  if (!file) return;

  setAIState("loading");
  aiSuggestBtn.disabled = true;

  // Показываем этапы 0-3 с задержками
  const preStages = AI_STAGES.slice(0, 4);
  for (let i = 0; i < preStages.length; i++) {
    const s = preStages[i];
    await new Promise(r => setTimeout(r, i === 0 ? 100 : 400));
    _setProgress(s.pct, s.text);
    _addLogEntry(s.icon, s.text);
  }

  // Медленно тикаем от 40% до 85% пока ждём ответа
  // При долгой загрузке модели (503 ретраи) обновляем статус каждые 10 сек
  _startSlowTick(40, 85);
  let _waitSec = 0;
  const _waitTimer = setInterval(() => {
    _waitSec += 10;
    if (_waitSec <= 15) return;
    const mins = Math.floor(_waitSec / 60);
    const secs = _waitSec % 60;
    const timeStr = mins > 0 ? `${mins}м ${secs}с` : `${secs}с`;
    const stage = _waitSec <= 60
      ? `⚙️ Загрузка модели в память... (${timeStr})`
      : `🤖 Генерация... (${timeStr})`;
    _addLogEntry("⏳", stage);
    _setProgress(undefined, stage.replace(/^[^\s]+ /, ""));
  }, 10000);

  const formData = new FormData();
  formData.set("file", file);

  try {
    const response = await fetch(`${API_BASE}/ai/suggest`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    _clearAITick();
    clearInterval(_waitTimer);

    // Этап «Обработка ответа»
    _setProgress(90, AI_STAGES[4].text);
    _addLogEntry(AI_STAGES[4].icon, AI_STAGES[4].text);
    await new Promise(r => setTimeout(r, 300));

    if (!response.ok || !data.ok) {
      _setProgress(100, "Ошибка");
      _addLogEntry("❌", data.error || "Ошибка ответа", "error");
      aiError.textContent = data.error || "Ошибка при обращении к ИИ-ассистенту.";
      setAIState("error");
      return;
    }

    _setProgress(100, AI_STAGES[5].text);
    _addLogEntry(AI_STAGES[5].icon, AI_STAGES[5].text, "success");

    _aiSuggestedSettings = data.settings;
    aiExplanation.textContent = data.explanation || "—";
    aiSettingsPreview.textContent = JSON.stringify(data.settings, null, 2);
    aiModelLabel.textContent = data.model ? `Модель: ${data.model}` : "";
    setAIState("result");

    // Показываем чат и добавляем первое сообщение ассистента
    _aiChatHistory = [{ role: "assistant", content: data.explanation || "Настройки подобраны. Задайте вопрос если что-то нужно изменить." }];
    aiChatMessages.innerHTML = "";
    _addChatMessage("assistant", data.explanation || "Настройки подобраны. Задайте вопрос если что-то нужно изменить.");
    aiChat.classList.remove("hidden");
  } catch (_) {
    _clearAITick();
    clearInterval(_waitTimer);
    _addLogEntry("❌", "Нет соединения с сервером", "error");
    aiError.textContent = "Не удалось подключиться к серверу. Проверьте, что бэкенд запущен.";
    setAIState("error");
  } finally {
    aiSuggestBtn.disabled = false;
  }
}

function applyAISettings(settings) {
  if (!settings || typeof settings !== "object") return;

  const FIELD_MAP = {
    method: (v) => { settingMethod.value = v; },
    pre_scale_factor: (v) => { settingPreScaleFactor.value = v; },
    min_area: (v) => { settingMinArea.value = v; },
    connect_radius_px: (v) => { settingConnectRadius.value = v; },
    connect_op: (v) => { settingConnectOp.value = v; },
    collinear_tol: (v) => { settingCollinearTol.value = v; },
    ignore_background: (v) => { settingIgnoreBackground.checked = Boolean(v); },
    draw_background: (v) => { settingDrawBackground.checked = Boolean(v); },
    connect_same_color: (v) => { settingConnectSameColor.checked = Boolean(v); },
    connect_4neighbors: (v) => { settingConnect4Neighbors.checked = Boolean(v); },
    simplify_collinear: (v) => { settingSimplifyCollinear.checked = Boolean(v); },
  };

  const extras = {};
  for (const [key, value] of Object.entries(settings)) {
    if (FIELD_MAP[key]) {
      try { FIELD_MAP[key](value); } catch (_) { /* skip */ }
    } else {
      extras[key] = value;
    }
  }

  if (Object.keys(extras).length > 0) {
    settingsJson.value = JSON.stringify(extras, null, 2);
  }
}

// ─── AI-чат ─────────────────────────────────────────────────

function _addChatMessage(role, text, newSettings) {
  const wrap = document.createElement("div");
  wrap.className = `ai-chat-msg ai-chat-msg-${role}`;

  const bubble = document.createElement("div");
  bubble.className = "ai-chat-bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);

  if (newSettings && typeof newSettings === "object") {
    const applyBtn = document.createElement("button");
    applyBtn.className = "btn ai-chat-apply-btn";
    applyBtn.textContent = "✅ Применить";
    applyBtn.addEventListener("click", () => {
      applyAISettings(newSettings);
      _aiSuggestedSettings = newSettings;
      aiSettingsPreview.textContent = JSON.stringify(newSettings, null, 2);
      applyBtn.textContent = "✅ Применено!";
      applyBtn.disabled = true;
    });
    wrap.appendChild(applyBtn);
  }

  aiChatMessages.appendChild(wrap);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

async function sendChatMessage() {
  const text = aiChatInput.value.trim();
  if (!text) return;

  aiChatInput.value = "";
  aiChatError.classList.add("hidden");
  aiChatSendBtn.disabled = true;

  _aiChatHistory.push({ role: "user", content: text });
  _addChatMessage("user", text);

  // Показываем индикатор ввода
  const typing = document.createElement("div");
  typing.className = "ai-chat-typing";
  typing.textContent = "⏳ Думаю...";
  aiChatMessages.appendChild(typing);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

  try {
    let currentSettings = null;
    try {
      currentSettings = collectSettings();
    } catch (_) {
      currentSettings = _aiSuggestedSettings || null;
    }

    const resp = await fetch(`${API_BASE}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: _aiChatHistory,
        current_settings: currentSettings,
        image_metrics: _aiImageMetrics || null,
      }),
    });

    let data = null;
    const raw = await resp.text();
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      data = { ok: false, error: raw || "Сервер вернул некорректный ответ" };
    }
    typing.remove();

    if (!resp.ok || !data.ok) {
      aiChatError.textContent = data.error || "Ошибка при обращении к ИИ.";
      aiChatError.classList.remove("hidden");
      return;
    }

    _aiChatHistory.push({ role: "assistant", content: data.reply });
    _addChatMessage("assistant", data.reply, data.new_settings);
  } catch (_) {
    typing.remove();
    aiChatError.textContent = "Нет соединения с сервером.";
    aiChatError.classList.remove("hidden");
    _aiChatHistory.pop();
  } finally {
    aiChatSendBtn.disabled = false;
    aiChatInput.focus();
  }
}


// ────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}, allowRefresh = true) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (isGuestMode) {
    headers.set("X-Guest-Token", ensureGuestToken());
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status !== 401 || !allowRefresh || isGuestMode) {
    return response;
  }

  const refreshed = await tryRefresh();
  if (!refreshed) {
    return response;
  }

  const retryHeaders = new Headers(options.headers || {});
  retryHeaders.set("Authorization", `Bearer ${getAccessToken()}`);
  return fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders });
}

async function tryRefresh() {
  if (isGuestMode) {
    return false;
  }
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    window.location.href = "login.html";
    return false;
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    window.location.href = "login.html";
    return false;
  }

  const data = await response.json();
  saveTokens(data);
  return true;
}

function clearPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function resetFlow() {
  clearPolling();
  currentJobId = null;
  fileInput.value = "";
  setProgress(0);
  setError("");
  logsOutput.textContent = "";
  showState("upload");
}

async function fetchJobs() {
  const response = await apiFetch("/jobs");
  if (!response.ok) {
    jobsList.innerHTML = "<li>Не удалось загрузить историю.</li>";
    return;
  }

  const jobs = await response.json();
  if (!jobs.length) {
    jobsList.innerHTML = "<li>История пока пустая.</li>";
    return;
  }

  jobsList.innerHTML = jobs
    .map((job) => {
      const error = job.error_text ? ` • ошибка: ${job.error_text}` : "";
      return `<li><strong>${job.id}</strong> • ${job.status}${error}</li>`;
    })
    .join("");
}

async function fetchJobLogs(jobId) {
  const response = await apiFetch(`/jobs/${jobId}/logs`);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  logsOutput.textContent = data.logs || "";
  logsOutput.scrollTop = logsOutput.scrollHeight;
}

async function pollJob(jobId) {
  const response = await apiFetch(`/jobs/${jobId}`);
  if (!response.ok) {
    clearPolling();
    setError("Не удалось получить статус задачи.");
    showState("upload");
    return;
  }

  const job = await response.json();
  await fetchJobLogs(jobId);

  if (job.status === "queued") {
    setProgress(25);
    showState("progress");
    return;
  }
  if (job.status === "running") {
    setProgress(70);
    showState("logs");
    return;
  }

  clearPolling();
  setProgress(100);
  if (job.status === "success") {
    showState("done");
  } else {
    showState("logs");
    setError(job.error_text || "Обработка завершилась с ошибкой.");
  }
  fetchJobs();
}

function startPolling(jobId) {
  clearPolling();
  pollTimer = setInterval(() => {
    pollJob(jobId).catch(() => {
      clearPolling();
      setError("Ошибка polling статуса.");
    });
  }, 2000);
  pollJob(jobId).catch(() => setError("Не удалось запустить polling."));
}

async function downloadFile(kind) {
  if (!currentJobId) {
    return;
  }

  const response = await apiFetch(`/jobs/${currentJobId}/download/${kind}`);
  if (!response.ok) {
    window.alert("Файл недоступен для скачивания.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentJobId}.${kind === "svg" ? "svg" : "log"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function createJob() {
  setError("");
  const file = fileInput.files?.[0];
  if (!file) {
    setError("Выберите BMP файл.");
    return;
  }
  if (!/\.bmp$/i.test(file.name)) {
    setError("Требуется файл формата .bmp");
    return;
  }

  let payloadSettings;
  try {
    payloadSettings = collectSettings();
  } catch (error) {
    setError(error.message || "Ошибка в настройках обработки.");
    return;
  }

  showState("progress");
  setProgress(10);

  const formData = new FormData();
  formData.set("file", file);
  formData.set("settings", JSON.stringify(payloadSettings));

  const response = await apiFetch("/jobs", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let detail = "Не удалось создать задачу.";
    try {
      const err = await response.json();
      if (err?.detail) {
        detail = err.detail;
      }
    } catch (_) {
      // Ignore parse issues and keep generic error text.
    }
    setError(detail);
    showState("upload");
    setProgress(0);
    return;
  }

  const data = await response.json();
  setGuestToken(data.guest_token || null);
  currentJobId = data.id;
  setProgress(20);
  showState("logs");
  startPolling(currentJobId);
  fetchJobs();
}

async function logout() {
  if (isGuestMode) {
    window.location.href = "login.html";
    return;
  }
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }
  clearTokens();
  window.location.href = "login.html";
}

function initUserMode() {
  const hasAuth = Boolean(getAccessToken() && getRefreshToken());
  isGuestMode = !hasAuth;

  if (isGuestMode) {
    ensureGuestToken();
    userInfo.textContent = "Пробный режим: вход не требуется";
    logoutBtn.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    registerBtn.classList.remove("hidden");
    return;
  }

  const email = localStorage.getItem("user_email") || "Пользователь";
  userInfo.textContent = `Личный кабинет: ${email}`;
  logoutBtn.classList.remove("hidden");
  loginBtn.classList.add("hidden");
  registerBtn.classList.add("hidden");
}

startJobBtn.addEventListener("click", () => {
  createJob().catch(() => setError("Сетевая ошибка при создании задачи."));
});
downloadSvgBtn.addEventListener("click", () => downloadFile("svg"));
downloadLogBtn.addEventListener("click", () => downloadFile("log"));
restartBtn.addEventListener("click", resetFlow);
logoutBtn.addEventListener("click", () => {
  logout().catch(() => {
    clearTokens();
    window.location.href = "login.html";
  });
});

// AI-кнопки
fileInput.addEventListener("change", () => {
  const hasFile = Boolean(fileInput.files?.[0]);
  aiSuggestBtn.disabled = !hasFile;
  // Сбрасываем предыдущий результат при смене файла
  setAIState("idle");
  _aiSuggestedSettings = null;
  _aiChatHistory = [];
  aiChatMessages.innerHTML = "";
  aiChatError.classList.add("hidden");
});

aiSuggestBtn.addEventListener("click", () => {
  askAI().catch(() => {
    aiError.textContent = "Непредвиденная ошибка при обращении к ИИ.";
    setAIState("error");
    aiSuggestBtn.disabled = false;
  });
});

aiApplyBtn.addEventListener("click", () => {
  if (_aiSuggestedSettings) {
    applyAISettings(_aiSuggestedSettings);
    aiApplyBtn.textContent = "✅ Применено!";
    setTimeout(() => { aiApplyBtn.textContent = "✅ Применить настройки"; }, 2000);
  }
});

aiChatSendBtn.addEventListener("click", () => sendChatMessage());
aiChatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});
aiChatClearBtn.addEventListener("click", () => {
  _aiChatHistory = [];
  aiChatMessages.innerHTML = "";
  aiChatError.classList.add("hidden");
});

if (resetDefaultsBtn) {
  resetDefaultsBtn.addEventListener("click", () => {
    resetSettingsToDefaults();
  });
}

if (aiChatMessages && aiChatMessages.childElementCount === 0) {
  _addChatMessage("assistant", "Можете обсудить настройки: например, «сделай меньше шум», «сохрани тонкие линии», «уменьши число узлов». ");
}

initUserMode();
resetFlow();
fetchJobs();
