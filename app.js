
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "personal-os-v2";

const today = new Date();
$("today").textContent = today.toLocaleDateString("ja-JP", {
  year: "numeric", month: "long", day: "numeric", weekday: "short"
});

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      todos: Array.isArray(saved?.todos) ? saved.todos : [],
      completed: Array.isArray(saved?.completed) ? saved.completed : [],
      expenses: Array.isArray(saved?.expenses) ? saved.expenses : [],
      later: Array.isArray(saved?.later) ? saved.later : [],
      lastGenre: saved?.lastGenre || "仕事",
      lastWeight: saved?.lastWeight || "normal"
    };
  } catch {
    return {
      todos: [], completed: [], expenses: [], later: [],
      lastGenre: "仕事", lastWeight: "normal"
    };
  }
}

const data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    alert("保存できませんでした。ブラウザの保存容量や設定を確認してください。");
    return false;
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function yen(amount) {
  return "¥" + Number(amount).toLocaleString("ja-JP");
}

function getTodayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function warningThreshold(weight) {
  return ({ heavy: 0.30, normal: 0.60, light: 0.85 })[weight] ?? 0.60;
}

function warningDue(task) {
  const start = new Date(task.createdAt + "T00:00:00").getTime();
  const end = new Date(task.due + "T00:00:00").getTime();
  const now = new Date(getTodayISO() + "T00:00:00").getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return false;
  }

  const progress = (now - start) / (end - start);
  return progress >= warningThreshold(task.weight);
}

function renderTodos() {
  const active = [...data.todos].sort((a, b) => a.due.localeCompare(b.due));
  $("todoCount").textContent = `${active.length} TASKS`;
  $("completedCount").textContent = data.completed.length;

  $("todoList").innerHTML = active.length ? active.map(task => {
    const overdue = task.due < getTodayISO();
    const warning = !overdue && warningDue(task);
    const weightName = ({ heavy: "重", normal: "普", light: "軽" })[task.weight] || "普";
    const status = overdue
      ? '<span class="overdue-text">OVERDUE</span>'
      : warning
        ? '<span class="warning-text">● WARNING</span>'
        : '<span>● ACTIVE</span>';

    return `
      <article class="task-card ${overdue ? "overdue" : warning ? "warning" : ""}">
        <div class="task-top">
          <div class="task-title">${escapeHTML(task.title)}</div>
          ${status}
        </div>
        <div class="task-meta">
          <span>${escapeHTML(task.genre)}</span>
          <span>期日 ${escapeHTML(task.due)}</span>
          <span>重さ ${weightName}</span>
          ${warning ? '<span class="warning-text">警告ライン到達</span>' : ""}
        </div>
        <div class="card-actions" style="margin-top:12px">
          <span class="muted small">登録 ${escapeHTML(task.createdAt)}</span>
          ${overdue
            ? `<button class="mini-btn" data-delete="${task.id}">削除</button>`
            : `<button class="mini-btn" data-complete="${task.id}">✓ 完了</button>`}
        </div>
      </article>`;
  }).join("") : '<div class="empty">TODOはまだありません。</div>';

  $("completedList").innerHTML = data.completed.length
    ? data.completed.map(task => `
      <article class="task-card done">
        <div class="task-top">
          <span class="task-title">${escapeHTML(task.title)}</span>
          <span class="muted small">✓ COMPLETE</span>
        </div>
        <div class="task-meta">
          <span>${escapeHTML(task.genre)}</span>
          <span>期日 ${escapeHTML(task.due)}</span>
        </div>
        <div class="card-actions" style="margin-top:10px">
          <span class="muted small">完了 ${escapeHTML(task.completedAt || "")}</span>
          <button class="mini-btn" data-restore="${task.id}">戻す</button>
        </div>
      </article>`).join("")
    : '<div class="empty">完了したTODOはここに表示されます。</div>';
}

$("todoForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const title = $("todoTitle").value.trim();
  const due = $("todoDue").value;
  if (!title || !due) return;

  const selectedWeight = document.querySelector('input[name="weight"]:checked');

  const task = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title,
    genre: $("todoGenre").value,
    due,
    weight: selectedWeight?.value || data.lastWeight,
    createdAt: getTodayISO()
  };

  data.todos.push(task);
  data.lastGenre = task.genre;
  data.lastWeight = task.weight;

  if (!saveData()) {
    data.todos = data.todos.filter(item => item.id !== task.id);
    return;
  }

  $("todoTitle").value = "";
  $("todoGenre").value = data.lastGenre;
  document.querySelector(`input[name="weight"][value="${data.lastWeight}"]`).checked = true;
  $("todoTitle").focus();
  renderTodos();
});

$("todoList").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.complete) {
    const index = data.todos.findIndex(task => task.id === button.dataset.complete);
    if (index < 0) return;
    const [task] = data.todos.splice(index, 1);
    task.completedAt = getTodayISO();
    data.completed.unshift(task);
    if (!saveData()) {
      data.completed.shift();
      data.todos.splice(index, 0, task);
      return;
    }
    renderTodos();
  }

  if (button.dataset.delete) {
    const index = data.todos.findIndex(task => task.id === button.dataset.delete);
    if (index < 0) return;
    const [removed] = data.todos.splice(index, 1);
    if (!saveData()) {
      data.todos.splice(index, 0, removed);
      return;
    }
    renderTodos();
  }
});

$("completedList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-restore]");
  if (!button) return;
  const index = data.completed.findIndex(task => task.id === button.dataset.restore);
  if (index < 0) return;
  const [task] = data.completed.splice(index, 1);
  delete task.completedAt;
  data.todos.push(task);
  if (!saveData()) {
    data.todos.pop();
    data.completed.splice(index, 0, task);
    return;
  }
  renderTodos();
});

function renderMoney() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const expenses = data.expenses.filter(item => item.date.startsWith(month));
  const spent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const budget = 100000;

  $("budgetView").textContent = yen(budget);
  $("spentView").textContent = yen(spent);
  $("remainingView").textContent = yen(Math.max(0, budget - spent));

  $("moneyList").innerHTML = expenses.length ? expenses.slice().reverse().map(item => `
    <div class="record-card">
      <span>${escapeHTML(item.date)}</span>
      <strong>${yen(item.amount)}</strong>
    </div>`).join("") : '<div class="empty">今月の支出はまだありません。</div>';
}

$("moneyForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("moneyAmount").value);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const item = {
    id: String(Date.now()),
    amount: Math.round(amount),
    date: getTodayISO()
  };

  data.expenses.push(item);
  if (!saveData()) {
    data.expenses.pop();
    return;
  }

  $("moneyAmount").value = "";
  renderMoney();
});

function renderLater() {
  $("laterList").innerHTML = data.later.length ? data.later.slice().reverse().map(item => `
    <article class="later-card">
      <div class="task-top">
        <strong>${escapeHTML(item.title || item.url || "メモ")}</strong>
        <button class="mini-btn" data-remove-later="${item.id}">削除</button>
      </div>
      ${item.url ? `<p><a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.url)}</a></p>` : ""}
      ${item.note ? `<p>${escapeHTML(item.note)}</p>` : ""}
      <div class="muted small">${escapeHTML(item.date)}</div>
    </article>`).join("") : '<div class="empty">保存したリンクやメモはここに表示されます。</div>';
}

$("laterForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const url = $("laterUrl").value.trim();
  const title = $("laterTitle").value.trim();
  const note = $("laterNote").value.trim();

  if (!url && !note && !title) return;

  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        alert("http または https のURLを入力してください。");
        return;
      }
    } catch {
      alert("URLの形式を確認してください。");
      return;
    }
  }

  const item = {
    id: String(Date.now()),
    title: title || (url ? new URL(url).hostname : "メモ"),
    url,
    note,
    date: getTodayISO()
  };

  data.later.push(item);
  if (!saveData()) {
    data.later.pop();
    return;
  }

  $("laterForm").reset();
  renderLater();
});

$("laterList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-later]");
  if (!button) return;
  const index = data.later.findIndex(item => item.id === button.dataset.removeLater);
  if (index < 0) return;
  const [removed] = data.later.splice(index, 1);
  if (!saveData()) {
    data.later.splice(index, 0, removed);
    return;
  }
  renderLater();
});

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.target).scrollIntoView({ behavior: "smooth", block: "start" });
    if (button.dataset.target === "todo") $("todoTitle").focus({ preventScroll: true });
    if (button.dataset.target === "money") $("moneyAmount").focus({ preventScroll: true });
    if (button.dataset.target === "later") $("laterTitle").focus({ preventScroll: true });
  });
});

$("todoGenre").value = data.lastGenre;
document.querySelector(`input[name="weight"][value="${data.lastWeight}"]`).checked = true;

renderTodos();
renderMoney();
renderLater();

