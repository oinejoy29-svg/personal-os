
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "personal-os-v3";

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
};
const monthISO = () => todayISO().slice(0, 7);
const yen = n => "¥" + Math.round(Number(n) || 0).toLocaleString("ja-JP");
const uid = () => crypto.randomUUID?.() || String(Date.now() + Math.random());

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

const defaults = {
  todos: [], completed: [], expenses: [], savings: [], goals: [], later: [],
  budget: 100000,
  lastGenre: "仕事",
  lastWeight: "normal"
};

function loadData() {
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (old && typeof old === "object") return { ...defaults, ...old };
  } catch {}
  // Import data from the previous prototype if present.
  try {
    const old = JSON.parse(localStorage.getItem("personal-os-v2"));
    if (old && typeof old === "object") return {
      ...defaults, ...old,
      expenses: Array.isArray(old.expenses) ? old.expenses : [],
      savings: [], goals: [],
      later: Array.isArray(old.later) ? old.later : []
    };
  } catch {}
  return { ...defaults };
}

const data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    alert("保存に失敗しました。ブラウザの保存設定や容量を確認してください。");
    return false;
  }
}

function addAndSave(collection, item) {
  data[collection].push(item);
  if (saveData()) return true;
  data[collection].pop();
  return false;
}

function setDefault(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function ensureExtraUI() {
  const money = $("money");
  if (money && !$("savingsForm")) {
    money.insertAdjacentHTML("beforeend", `
      <div class="section-head" style="margin-top:24px">
        <h3>MONTHLY SETTINGS</h3>
      </div>
      <form id="budgetForm" class="inline-form">
        <input id="budgetInput" type="number" min="0" step="1"
          placeholder="今月の予算（円）" required>
        <button class="primary" type="submit">予算設定</button>
      </form>

      <div class="money-grid">
        <div class="metric">
          <span class="muted small">今月の貯金</span>
          <strong id="monthlySavingsView">¥0</strong>
        </div>
        <div class="metric">
          <span class="muted small">累計貯金</span>
          <strong id="totalSavingsView">¥0</strong>
        </div>
      </div>

      <form id="savingsForm" class="inline-form">
        <input id="savingsAmount" type="number" min="1" step="1"
          placeholder="貯金額（円）" required>
        <button class="primary" type="submit">＋ 貯金記録</button>
      </form>
      <div id="savingsList" class="record-list"></div>

      <div class="section-head" style="margin-top:26px">
        <h3>PURCHASE GOALS</h3>
      </div>
      <form id="goalForm" class="todo-form">
        <input id="goalTitle" placeholder="買いたいもの" required maxlength="120">
        <div class="form-row">
          <input id="goalAmount" type="number" min="1" step="1"
            placeholder="目標金額（円）" required>
          <input id="goalDate" type="date" aria-label="購入希望日" required>
        </div>
        <button class="primary" type="submit">＋ 購入目標を追加</button>
      </form>
      <div id="goalList" class="record-list"></div>
    `);
  }

  const later = $("later");
  if (later && !$("laterNote")) {
    $("laterForm")?.insertAdjacentHTML("beforeend", `
      <textarea id="laterNote" rows="2" placeholder="メモ（任意）"></textarea>
    `);
  }
}

// TODO
function warningThreshold(weight) {
  return ({ heavy: 0.30, normal: 0.60, light: 0.85 })[weight] ?? 0.60;
}
function warningDue(task) {
  const start = new Date(task.createdAt + "T00:00:00").getTime();
  const end = new Date(task.due + "T00:00:00").getTime();
  const now = new Date(todayISO() + "T00:00:00").getTime();
  return end > start &&
    (now - start) / (end - start) >= warningThreshold(task.weight);
}

function renderTodos() {
  if (!$("todoList")) return;

  const today = todayISO();

  // 締切が近い順。期限超過も上に表示する
  const active = [...data.todos].sort((a, b) => {
    return (a.due || "9999-12-31").localeCompare(
      b.due || "9999-12-31"
    );
  });

  $("todoCount").textContent = `${active.length}件`;
  $("completedCount").textContent = data.completed.length;

  $("todoList").innerHTML = active.length
    ? active.map(t => {
        const overdue = t.due && t.due < today;
        const warning = !overdue && warningDue(t);

        const weight = {
          heavy: "重い",
          normal: "普通",
          light: "軽い"
        }[t.weight] || "普通";

        return `
          <article class="task-card
            ${overdue ? "overdue" : warning ? "warning" : ""}">

            <div class="task-status ${
              overdue ? "overdue-text" :
              warning ? "warning-text" : ""
            }">
              ${overdue ? "期限超過" :
                warning ? "そろそろ着手" : "未完了"}
            </div>

            <div class="task-title">
              ${escapeHTML(t.title)}
            </div>

            <div class="task-due">
              ${t.due
                ? "締切 " + escapeHTML(t.due)
                : "締切なし"}
            </div>

            <div class="task-meta">
              <span>${escapeHTML(t.genre || "未分類")}</span>
              <span>負荷：${weight}</span>
            </div>

            <details class="task-details">
              <summary>詳細・操作</summary>

              <div class="task-detail-content">
                <p>登録日：${escapeHTML(t.createdAt || "不明")}</p>

                ${
                  overdue
                    ? `<button class="mini-btn danger-btn"
                         data-delete-todo="${t.id}">
                         タスクを削除
                       </button>`
                    : `<button class="primary task-action"
                         data-complete-todo="${t.id}">
                         ✓ 完了にする
                       </button>`
                }
              </div>
            </details>
          </article>
        `;
      }).join("")
    : '<div class="empty">タスクはありません。追加してみよう！</div>';

  $("completedList").innerHTML = data.completed.length
    ? [...data.completed].map(t => `
        <article class="task-card done">
          <div class="task-status">完了</div>
          <div class="task-title">${escapeHTML(t.title)}</div>
          <div class="task-due">
            締切 ${escapeHTML(t.due || "なし")}
          </div>
          <details class="task-details">
            <summary>詳細・操作</summary>
            <div class="task-detail-content">
              <button class="mini-btn"
                data-restore-todo="${t.id}">
                未完了に戻す
              </button>
            </div>
          </details>
        </article>
      `).join("")
    : '<div class="empty">完了したタスクはここに表示されます。</div>';
}

$("todoForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const title = $("todoTitle").value.trim();
  const due = $("todoDue").value;
  if (!title || !due) return;
  const task = {
    id: uid(), title, due, genre: $("todoGenre").value,
    weight: document.querySelector('input[name="weight"]:checked')?.value || data.lastWeight,
    createdAt: todayISO()
  };
  if (!addAndSave("todos", task)) return;
  data.lastGenre = task.genre;
  data.lastWeight = task.weight;
  saveData();
  $("todoTitle").value = "";
  $("todoGenre").value = data.lastGenre;
  document.querySelector(`input[name="weight"][value="${data.lastWeight}"]`).checked = true;
  renderTodos();
  $("todoTitle").focus();
});

$("todoList")?.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.completeTodo) {
    const i = data.todos.findIndex(t => t.id === b.dataset.completeTodo);
    if (i < 0) return;
    const [t] = data.todos.splice(i, 1);
    t.completedAt = todayISO();
    data.completed.unshift(t);
    if (!saveData()) { data.completed.shift(); data.todos.splice(i, 0, t); }
    renderTodos();
  }
  if (b.dataset.deleteTodo) {
    const i = data.todos.findIndex(t => t.id === b.dataset.deleteTodo);
    if (i < 0) return;
    const [t] = data.todos.splice(i, 1);
    if (!saveData()) data.todos.splice(i, 0, t);
    renderTodos();
  }
});

$("completedList")?.addEventListener("click", e => {
  const b = e.target.closest("[data-restore-todo]");
  if (!b) return;
  const i = data.completed.findIndex(t => t.id === b.dataset.restoreTodo);
  if (i < 0) return;
  const [t] = data.completed.splice(i, 1);
  delete t.completedAt;
  data.todos.push(t);
  if (!saveData()) { data.todos.pop(); data.completed.splice(i, 0, t); }
  renderTodos();
});

// MONEY
function currentMonthExpenses() {
  return data.expenses.filter(x => (x.date || "").startsWith(monthISO()));
}
function renderMoney() {
  if (!$("spentView")) return;
  const expenses = currentMonthExpenses();
  const spent = expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const budget = Math.max(0, Number(data.budget) || 0);
  const remaining = budget - spent;

  $("budgetView").textContent = yen(budget);
  $("spentView").textContent = yen(spent);
  $("remainingView").textContent = yen(remaining);
  setDefault("budgetInput", budget);

  $("moneyList").innerHTML = expenses.length ? [...expenses].reverse().map(x => `
    <div class="record-card">
      <div><strong>${yen(x.amount)}</strong><div class="muted small">${escapeHTML(x.date)}</div></div>
      <button class="mini-btn" data-delete-expense="${x.id}">削除</button>
    </div>`).join("") : '<div class="empty">今月の支出はありません。</div>';

  const savingsThisMonth = data.savings.filter(x => (x.date || "").startsWith(monthISO()));
  $("monthlySavingsView").textContent = yen(savingsThisMonth.reduce((s, x) => s + x.amount, 0));
  $("totalSavingsView").textContent = yen(data.savings.reduce((s, x) => s + x.amount, 0));

  $("savingsList").innerHTML = data.savings.length ? [...data.savings].reverse().map(x => `
    <div class="record-card">
      <div><strong>${yen(x.amount)}</strong><div class="muted small">${escapeHTML(x.date)}</div></div>
      <button class="mini-btn" data-delete-saving="${x.id}">削除</button>
    </div>`).join("") : '<div class="empty">貯金記録はありません。</div>';

  $("goalList").innerHTML = data.goals.length ? data.goals.map(g => {
    const months = Math.max(1, (
      (new Date(g.date + "T00:00:00").getFullYear() - new Date(todayISO() + "T00:00:00").getFullYear()) * 12
      + new Date(g.date + "T00:00:00").getMonth() - new Date(todayISO() + "T00:00:00").getMonth()
    ) + 1);
    const monthly = Math.ceil(g.amount / months);
    return `<div class="record-card">
      <div>
        <strong>${escapeHTML(g.title)}</strong>
        <div class="muted small">目標 ${yen(g.amount)} · ${escapeHTML(g.date)}</div>
        <div class="small">月々の目安 <strong>${yen(monthly)}</strong></div>
      </div>
      <button class="mini-btn" data-delete-goal="${g.id}">削除</button>
    </div>`;
  }).join("") : '<div class="empty">購入目標はまだありません。</div>';
}

$("budgetForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const value = Number($("budgetInput").value);
  if (!Number.isFinite(value) || value < 0) return;
  const previous = data.budget;
  data.budget = Math.round(value);
  if (!saveData()) data.budget = previous;
  renderMoney();
});

$("moneyForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const amount = Math.round(Number($("moneyAmount").value));
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!addAndSave("expenses", { id: uid(), amount, date: todayISO() })) return;
  $("moneyAmount").value = "";
  renderMoney();
});

$("savingsForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const amount = Math.round(Number($("savingsAmount").value));
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (!addAndSave("savings", { id: uid(), amount, date: todayISO() })) return;
  $("savingsAmount").value = "";
  renderMoney();
});

$("goalForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const title = $("goalTitle").value.trim();
  const amount = Math.round(Number($("goalAmount").value));
  const date = $("goalDate").value;
  if (!title || amount <= 0 || !date) return;
  if (!addAndSave("goals", { id: uid(), title, amount, date })) return;
  $("goalForm").reset();
  renderMoney();
});

$("money")?.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  for (const [attr, key] of [
    ["delete-expense", "expenses"], ["delete-saving", "savings"], ["delete-goal", "goals"]
  ]) {
    const id = b.dataset[attr];
    if (!id) continue;
    const i = data[key].findIndex(x => x.id === id);
    if (i < 0) return;
    const [item] = data[key].splice(i, 1);
    if (!saveData()) data[key].splice(i, 0, item);
    renderMoney();
    return;
  }
});

// LATER
function normalizeURL(raw) {
  if (!raw) return "";
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) value = "https://" + value;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
  return url.href;
}

function renderLater() {
  if (!$("laterList")) return;
  $("laterList").innerHTML = data.later.length ? [...data.later].reverse().map(item => `
    <article class="later-card">
      <div class="task-top">
        <strong>${escapeHTML(item.title || item.url || "メモ")}</strong>
        <div class="card-actions">
          <button class="mini-btn" data-edit-later="${item.id}">編集</button>
          <button class="mini-btn" data-delete-later="${item.id}">削除</button>
        </div>
      </div>
      ${item.url ? `<p><a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.url)}</a></p>` : ""}
      ${item.note ? `<p>${escapeHTML(item.note)}</p>` : ""}
      <div class="muted small">${escapeHTML(item.date)}</div>
    </article>`).join("") : '<div class="empty">保存したリンクやメモはありません。</div>';
}

$("laterForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const rawURL = $("laterUrl").value.trim();
  const title = $("laterTitle").value.trim();
  const note = $("laterNote").value.trim();
  if (!rawURL && !note && !title) return;

  let url = "";
  try {
    if (rawURL) url = normalizeURL(rawURL);
  } catch {
    alert("URLを確認してください。");
    return;
  }

  const defaultTitle = url ? new URL(url).hostname : "メモ";
  if (!addAndSave("later", {
    id: uid(), title: title || defaultTitle, url, note, date: todayISO()
  })) return;

  $("laterForm").reset();
  renderLater();
  $("laterTitle").focus();
});

$("laterList")?.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;

  if (b.dataset.deleteLater) {
    const i = data.later.findIndex(x => x.id === b.dataset.deleteLater);
    if (i < 0) return;
    const [item] = data.later.splice(i, 1);
    if (!saveData()) data.later.splice(i, 0, item);
    renderLater();
  }

  if (b.dataset.editLater) {
    const item = data.later.find(x => x.id === b.dataset.editLater);
    if (!item) return;
    const title = prompt("タイトル", item.title);
    if (title === null) return;
    const note = prompt("メモ", item.note || "");
    if (note === null) return;
    const oldTitle = item.title;
    const oldNote = item.note;
    item.title = title.trim() || (item.url ? new URL(item.url).hostname : "メモ");
    item.note = note;
    if (!saveData()) { item.title = oldTitle; item.note = oldNote; }
    renderLater();
  }
});

// QUICK ADD navigation
document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    button.classList.add("active");
    const target = $(button.dataset.target);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    const focusTarget = {
      todo: "todoTitle", money: "moneyAmount", later: "laterTitle"
    }[button.dataset.target];
    if (focusTarget) $(focusTarget)?.focus({ preventScroll: true });
  });
});

ensureExtraUI();

setDefault("todoGenre", data.lastGenre);
const savedWeight = document.querySelector(
  `input[name="weight"][value="${data.lastWeight}"]`
);
if (savedWeight) savedWeight.checked = true;

renderTodos();
renderMoney();
renderLater();
