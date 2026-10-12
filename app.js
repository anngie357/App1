const STORAGE_KEY = "daymark-data-v1";
const SETTINGS_KEY = "daymark-settings-v1";
const backgroundColors = { sage: "#f7f8f4", sky: "#f1f6f8", rose: "#faf2ef", mint: "#f0f6f1", lavender: "#f5f2f8", butter: "#faf4df", peach: "#faece4", slate: "#edf0f2", ice: "#e9f4f8", seafoam: "#e7f4ef" };
const darkBackgroundColors = { sage: "#18211b", sky: "#172127", rose: "#241c1c", mint: "#18221e", lavender: "#201d26", butter: "#242117", peach: "#271f1a", slate: "#1c2023", ice: "#172226", seafoam: "#18231f" };
const today = new Date();
const todayKey = toDateKey(today);
const state = loadState();
const settings = loadSettings();
let activeView = "overview";
let activePeriod = "month";
let toastTimer;

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.activities) && Array.isArray(stored.goals)) return stored;
  } catch (error) {
    console.warn("Could not load saved progress.", error);
  }
  return {
    activities: [
      { id: crypto.randomUUID(), title: "Take a 10-minute walk", date: todayKey, done: true },
      { id: crypto.randomUUID(), title: "Read a few pages", date: todayKey, done: false },
      { id: crypto.randomUUID(), title: "Write down one thing I'm grateful for", date: todayKey, done: false },
    ],
    goals: [
      { id: crypto.randomUUID(), title: "Make time for a book I love", dueDate: `${today.getFullYear()}-12-15`, done: false, completedAt: null },
      { id: crypto.randomUUID(), title: "Try something I've never done before", dueDate: `${today.getFullYear()}-11-30`, done: false, completedAt: null },
    ],
  };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (stored) return { background: backgroundColors[stored.background] ? stored.background : "sage", theme: ["light", "dark"].includes(stored.theme) ? stored.theme : "light", fontSize: ["small", "standard", "large"].includes(stored.fontSize) ? stored.fontSize : "standard", scale: Math.min(120, Math.max(80, Number(stored.scale) || 100)) };
  } catch (error) {
    console.warn("Could not load appearance settings.", error);
  }
  return { background: "sage", theme: "light", fontSize: "standard", scale: 100 };
}

function applySettings() {
  const fontScales = { small: 0.9, standard: 1, large: 1.15 };
  document.documentElement.dataset.theme = settings.theme;
  const selectedBackground = settings.theme === "dark" ? darkBackgroundColors[settings.background] : backgroundColors[settings.background];
  document.documentElement.style.setProperty("--page-background", selectedBackground);
  const interfaceScale = settings.scale / 100;
  const appShell = document.querySelector(".app-shell");
  appShell.style.transform = `scale(${interfaceScale})`;
  appShell.style.transformOrigin = "top left";
  appShell.style.width = `${100 / interfaceScale}%`;
  appShell.style.minHeight = `${100 / interfaceScale}vh`;
  document.getElementById("font-size-setting").value = settings.fontSize;
  document.getElementById("scale-setting").value = settings.scale;
  document.getElementById("scale-value").value = `${settings.scale}%`;
  document.getElementById("scale-value").textContent = `${settings.scale}%`;
  document.querySelectorAll(".background-swatch").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.background === settings.background)));
  document.querySelectorAll("[data-theme-choice]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.themeChoice === settings.theme)));

  const scale = fontScales[settings.fontSize];
  const elements = [...document.body.querySelectorAll("*")];
  const baseSizes = elements.map((element) => element.dataset.settingsBaseFontSize || getComputedStyle(element).fontSize);
  elements.forEach((element, index) => {
    element.dataset.settingsBaseFontSize = baseSizes[index];
    element.style.fontSize = `${parseFloat(baseSizes[index]) * scale}px`;
  });
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function formatDate(dateKey, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!dateKey) return "";
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${dateKey}T12:00:00`));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function renderActivities() {
  const list = document.getElementById("activity-list");
  const activities = state.activities.filter((activity) => activity.date === todayKey);
  const completed = activities.filter((activity) => activity.done).length;
  document.getElementById("daily-count").textContent = `${completed} / ${activities.length}`;
  document.getElementById("daily-progress-fill").style.width = `${activities.length ? completed / activities.length * 100 : 0}%`;
  list.innerHTML = activities.length ? activities.map((activity) => `
    <div class="activity-item ${activity.done ? "is-done" : ""}">
      <button class="check-control ${activity.done ? "checked" : ""}" data-activity-check="${activity.id}" aria-label="${activity.done ? "Mark incomplete" : "Mark complete"}" aria-pressed="${activity.done}">${activity.done ? "✓" : ""}</button>
      <span class="activity-title">${escapeHTML(activity.title)}</span>
      <button class="delete-button" data-activity-delete="${activity.id}" aria-label="Remove ${escapeHTML(activity.title)}" title="Remove activity">×</button>
    </div>`).join("") : `<p class="empty-state">A fresh page. Add one small thing you'd like to do today.</p>`;
  list.querySelectorAll("[data-activity-check]").forEach((button) => button.addEventListener("click", () => toggleActivity(button.dataset.activityCheck)));
  list.querySelectorAll("[data-activity-delete]").forEach((button) => button.addEventListener("click", () => deleteActivity(button.dataset.activityDelete)));
}

function renderGoals() {
  const sorted = [...state.goals].sort((first, second) => Number(first.done) - Number(second.done) || first.dueDate.localeCompare(second.dueDate));
  const previews = sorted.slice(0, 2);
  document.getElementById("goal-preview-list").innerHTML = previews.length ? previews.map((goal) => `
    <div class="goal-preview ${goal.done ? "done" : ""}">
      <button class="check-control ${goal.done ? "checked" : ""}" data-goal-check="${goal.id}" aria-label="${goal.done ? "Mark goal incomplete" : "Mark goal achieved"}" aria-pressed="${goal.done}">${goal.done ? "✓" : ""}</button>
      <div class="goal-preview-copy"><span class="goal-preview-title">${escapeHTML(goal.title)}</span><span class="goal-due">${goal.done ? `Achieved ${formatDate(goal.completedAt)}` : `Due ${formatDate(goal.dueDate)}`}</span></div>
    </div>`).join("") : `<p class="empty-state">Your next big thing can start with one small goal.</p>`;
  document.getElementById("goal-count").textContent = `${state.goals.length} ${state.goals.length === 1 ? "goal" : "goals"}`;
  document.getElementById("goal-list").innerHTML = sorted.length ? sorted.map((goal) => `
    <div class="goal-item ${goal.done ? "is-done" : ""}">
      <button class="check-control ${goal.done ? "checked" : ""}" data-goal-check="${goal.id}" aria-label="${goal.done ? "Mark goal incomplete" : "Mark goal achieved"}" aria-pressed="${goal.done}">${goal.done ? "✓" : ""}</button>
      <div class="goal-copy"><span class="goal-title">${escapeHTML(goal.title)}</span><span class="goal-meta"><span>${goal.done ? `Achieved ${formatDate(goal.completedAt)}` : `Target date ${formatDate(goal.dueDate)}`}</span>${goal.done && goal.dueDate ? `<span>Target ${formatDate(goal.dueDate)}</span>` : ""}</span></div>
      <button class="delete-button" data-goal-delete="${goal.id}" aria-label="Remove ${escapeHTML(goal.title)}" title="Remove goal">×</button>
    </div>`).join("") : `<p class="empty-state">Nothing on the list yet. Add a goal when you know what you'd like to work toward.</p>`;
  document.querySelectorAll("[data-goal-check]").forEach((button) => button.addEventListener("click", () => toggleGoal(button.dataset.goalCheck)));
  document.querySelectorAll("[data-goal-delete]").forEach((button) => button.addEventListener("click", () => deleteGoal(button.dataset.goalDelete)));
}

function monthData(monthKey) {
  const activities = state.activities.filter((activity) => activity.date.startsWith(monthKey));
  const goals = state.goals.filter((goal) => goal.done ? goal.completedAt?.startsWith(monthKey) : goal.dueDate.startsWith(monthKey));
  const done = activities.filter((activity) => activity.done).length + goals.filter((goal) => goal.done && goal.completedAt.startsWith(monthKey)).length;
  const total = activities.length + goals.length;
  return { done, total, open: Math.max(0, total - done), goalsDone: goals.filter((goal) => goal.done && goal.completedAt.startsWith(monthKey)).length };
}

function renderPie(element, labelElement, done, total) {
  const percentage = total ? Math.round(done / total * 100) : 0;
  const degrees = total ? done / total * 360 : 0;
  element.style.background = `conic-gradient(var(--green) 0deg ${degrees}deg, var(--chart-open, #e9eee8) ${degrees}deg 360deg)`;
  labelElement.textContent = `${percentage}%`;
  return percentage;
}

function renderMonthReport(monthKey) {
  const data = monthData(monthKey);
  const title = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(`${monthKey}-15T12:00:00`));
  document.getElementById("month-report-title").textContent = title;
  document.getElementById("month-done").textContent = data.done;
  document.getElementById("month-open").textContent = data.open;
  document.getElementById("month-total").textContent = `${data.total} ${data.total === 1 ? "thing" : "things"} tracked`;
  document.getElementById("month-goals-done").textContent = data.goalsDone;
  const percentage = renderPie(document.getElementById("month-pie"), document.getElementById("month-pie-label"), data.done, data.total);
  document.getElementById("month-insight-title").textContent = data.total ? percentage === 100 ? "Look at you, showing up." : "Your progress is taking shape." : "Your month is yours to shape.";
  document.getElementById("month-insight-copy").textContent = data.total ? `${data.done} of ${data.total} tracked ${data.total === 1 ? "item is" : "items are"} complete. Every effort is a step worth recognizing.` : "Add daily activities and dated goals to see your progress take shape here.";
}

function renderOverviewMonth() {
  const data = monthData(todayKey.slice(0, 7));
  document.getElementById("overview-month").textContent = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(today);
  document.getElementById("overview-done").textContent = data.done;
  document.getElementById("overview-open").textContent = data.open;
  renderPie(document.getElementById("overview-pie"), document.getElementById("overview-pie-label"), data.done, data.total);
}

function yearlyItems(year) {
  const yearPrefix = `${year}-`;
  const activities = state.activities.filter((activity) => activity.date.startsWith(yearPrefix)).map((activity) => ({ date: activity.date, done: activity.done }));
  const goals = state.goals.filter((goal) => goal.done ? goal.completedAt?.startsWith(yearPrefix) : goal.dueDate.startsWith(yearPrefix)).map((goal) => ({ date: goal.done ? goal.completedAt : goal.dueDate, done: goal.done }));
  return [...activities, ...goals];
}

function renderYearReport(year) {
  const yearNum = Number(year);
  const items = yearlyItems(yearNum);
  const monthLabels = new Intl.DateTimeFormat(undefined, { month: "short" });
  document.getElementById("year-month-chart").innerHTML = Array.from({ length: 12 }, (_, month) => {
    const monthItems = items.filter((item) => Number(item.date.slice(5, 7)) === month + 1);
    const done = monthItems.filter((item) => item.done).length;
    const rate = monthItems.length ? Math.round(done / monthItems.length * 100) : 0;
    const label = monthLabels.format(new Date(yearNum, month, 1, 12));
    const count = monthItems.length ? `${done}/${monthItems.length}` : "No data";
    const description = monthItems.length ? `${rate}% complete, ${done} of ${monthItems.length} items` : "No items tracked";
    return `<div class="year-month-column${monthItems.length ? "" : " is-empty"}" role="listitem" aria-label="${label}: ${description}"><span class="year-month-rate">${monthItems.length ? `${rate}%` : "—"}</span><div class="year-month-bar-track"><span style="height: ${rate}%"></span></div><div class="year-month-label"><span>${label}</span><span class="year-month-count">${count}</span></div></div>`;
  }).join("");
  const completed = items.filter((item) => item.done).length;
  const achievedGoals = state.goals.filter((goal) => goal.done && goal.completedAt.startsWith(`${yearNum}-`)).length;
  document.getElementById("year-report-title").textContent = `${yearNum} at a glance`;
  document.getElementById("year-total-count").textContent = `${completed} ${completed === 1 ? "thing" : "things"} completed`;
  document.getElementById("year-total-copy").textContent = yearNum === today.getFullYear() && today.getMonth() < 11 ? `A running tally for ${yearNum}. Keep going at your own pace.` : "All those small steps belong to you.";
  document.getElementById("year-goals-count").textContent = achievedGoals;
}

function refreshReports() {
  const monthPicker = document.getElementById("month-picker");
  if (!monthPicker.value) monthPicker.value = todayKey.slice(0, 7);
  renderMonthReport(monthPicker.value);
  renderOverviewMonth();
  const yearPicker = document.getElementById("year-picker");
  if (!yearPicker.options.length) {
    const years = new Set([today.getFullYear()]);
    [...state.activities, ...state.goals].forEach((item) => [item.date, item.dueDate, item.completedAt].filter(Boolean).forEach((date) => years.add(Number(date.slice(0, 4)))));
    [...years].sort((first, second) => second - first).forEach((year) => {
      const option = document.createElement("option"); option.value = year; option.textContent = year; yearPicker.append(option);
    });
  }
  renderYearReport(yearPicker.value || today.getFullYear());
}

function refresh() { renderActivities(); renderGoals(); refreshReports(); applySettings(); saveState(); }

function toggleActivity(id) {
  const activity = state.activities.find((item) => item.id === id);
  if (!activity) return;
  activity.done = !activity.done; refresh(); showToast(activity.done ? "Activity checked off. Nice work." : "Activity moved back to your list.");
}

function toggleGoal(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;
  goal.done = !goal.done; goal.completedAt = goal.done ? todayKey : null; refresh();
  showToast(goal.done ? "Goal achieved. This is part of your progress now." : "Goal reopened. Your progress has been updated.");
}

function deleteActivity(id) { state.activities = state.activities.filter((activity) => activity.id !== id); refresh(); showToast("Activity removed."); }
function deleteGoal(id) { state.goals = state.goals.filter((goal) => goal.id !== id); refresh(); showToast("Goal removed."); }

function switchView(view) {
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.getElementById("current-section").textContent = view.toUpperCase();
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => {
  activePeriod = button.dataset.period;
  document.querySelectorAll("[data-period]").forEach((tab) => { const selected = tab === button; tab.classList.toggle("active", selected); tab.setAttribute("aria-selected", String(selected)); });
  document.querySelectorAll(".report-view").forEach((section) => section.classList.toggle("active", section.id === `${activePeriod}-report`));
}));

document.getElementById("activity-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("activity-input"); const title = input.value.trim();
  if (!title) return;
  state.activities.push({ id: crypto.randomUUID(), title, date: todayKey, done: false }); input.value = ""; refresh(); showToast("Added to today's activities.");
});

document.getElementById("goal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("goal-input"); const dateInput = document.getElementById("goal-date"); const title = input.value.trim();
  if (!title || !dateInput.value) return;
  state.goals.push({ id: crypto.randomUUID(), title, dueDate: dateInput.value, done: false, completedAt: null }); input.value = ""; dateInput.value = ""; refresh(); showToast("Your goal has been added.");
});

document.getElementById("jump-to-add").addEventListener("click", () => { document.getElementById("activity-input").focus(); document.getElementById("activity-form").scrollIntoView({ behavior: "smooth", block: "center" }); });
document.getElementById("month-picker").addEventListener("change", (event) => renderMonthReport(event.target.value));
document.getElementById("year-picker").addEventListener("change", (event) => { renderYearReport(event.target.value); applySettings(); });

const settingsPanel = document.getElementById("settings-panel");
const settingsToggle = document.getElementById("settings-toggle");
settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});
document.getElementById("settings-close").addEventListener("click", () => {
  settingsPanel.hidden = true;
  settingsToggle.setAttribute("aria-expanded", "false");
  settingsToggle.focus();
});
document.querySelectorAll(".background-swatch").forEach((button) => button.addEventListener("click", () => {
  settings.background = button.dataset.background;
  saveSettings();
}));
document.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => {
  settings.theme = button.dataset.themeChoice;
  saveSettings();
}));
document.getElementById("font-size-setting").addEventListener("change", (event) => {
  settings.fontSize = event.target.value;
  saveSettings();
});
document.getElementById("scale-setting").addEventListener("input", (event) => {
  settings.scale = Number(event.target.value);
  saveSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    settingsToggle.setAttribute("aria-expanded", "false");
    settingsToggle.focus();
  }
});

const friendlyDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
document.getElementById("welcome-date").textContent = friendlyDate.format(today).toUpperCase();
document.getElementById("top-date").textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(today);
document.getElementById("goal-date").min = todayKey;
applySettings();
refresh();