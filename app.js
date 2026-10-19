
const today = document.querySelector("#today");
today.textContent = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const completedCount = document.querySelector("#completed-count");

let completed = 0;

function updateTaskCount() {
  taskCount.textContent = `${taskList.children.length} TASKS`;
  completedCount.textContent = `${completed} tasks`;
}

function connectCompleteButton(button) {
  button.addEventListener("click", () => {
    button.closest(".task").remove();
    completed++;
    updateTaskCount();
  });
}

document.querySelectorAll(".complete-button").forEach(connectCompleteButton);

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;

  const task = document.createElement("div");
  task.className = "task";

  const marker = document.createElement("span");
  marker.className = "task-marker";

  const content = document.createElement("div");
  content.className = "task-content";

  const strong = document.createElement("strong");
  strong.textContent = title;

  const small = document.createElement("small");
  small.textContent = "NORMAL PRIORITY · NEW TASK";

  content.append(strong, small);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "complete-button";
  button.textContent = "COMPLETE ✓";
  connectCompleteButton(button);

  task.append(marker, content, button);
  taskList.append(task);
  taskInput.value = "";
  updateTaskCount();
});

const spentButton = document.querySelector("#spent-button");
const budget = 100000;
let spent = 20000;

function updateMoney() {
  const remaining = budget - spent;
  document.querySelector("#remaining").textContent =
    `¥${remaining.toLocaleString("ja-JP")}`;
  spentButton.textContent = `¥${spent.toLocaleString("ja-JP")} ＋`;

  const ratio = Math.min(100, Math.max(0, spent / budget * 100));
  document.querySelector("#spent-percent").textContent = `${Math.round(ratio)}%`;
  document.querySelector("#donut").style.background =
    `conic-gradient(#f07878 0% ${ratio}%, #54d6a0 ${ratio}% 100%)`;
}

spentButton.addEventListener("click", () => {
  const value = prompt("追加する支出額（円）を入力してください");
  if (value === null || value.trim() === "") return;

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("0より大きい金額を入力してください。");
    return;
  }

  spent += Math.floor(amount);
  updateMoney();
});

const laterForm = document.querySelector("#later-form");
const laterTitle = document.querySelector("#later-title");
const laterUrl = document.querySelector("#later-url");
const laterList = document.querySelector("#later-list");

laterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = laterTitle.value.trim();
  const url = laterUrl.value.trim();

  if (!title) return;
  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      alert("有効なURLを入力してください。");
      return;
    }
  }

  const empty = laterList.querySelector(".empty-state");
  if (empty) empty.remove();

  const card = document.createElement("div");
  card.className = "later-card";

  const info = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  info.append(heading);

  if (url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = new URL(url).hostname;
    info.append(link);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-button";
  remove.textContent = "DELETE";
  remove.addEventListener("click", () => {
    card.remove();
    if (!laterList.children.length) {
      const message = document.createElement("p");
      message.className = "empty-state";
      message.textContent = "まだ保存したものはありません。";
      laterList.append(message);
    }
  });

  card.append(info, remove);
  laterList.append(card);
  laterTitle.value = "";
  laterUrl.value = "";
});

updateTaskCount();
updateMoney();
