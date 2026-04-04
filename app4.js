let sessions = JSON.parse(localStorage.getItem("sessions")) || [];
let userSettings = JSON.parse(localStorage.getItem("settings")) || {};

let config = {};
let messages = {};
let categoriesData = {};
let emotionsData = [];
let badgesData = [];

let startTime = null;

// DOM
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const stato = document.getElementById("stato");
const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const sessionList = document.getElementById("sessionList");
const pointsDisplay = document.getElementById("points");
//const toneSelect = document.getElementById("toneSelect");
const toneButtons = document.querySelectorAll(".tone-picker button");
const messageBox = document.getElementById("message");
const emotionSelect = document.getElementById("emotion");
const moveTimeEl = document.getElementById("moveTime");
const deviceTimeEl = document.getElementById("deviceTime");
const topEmotionEl = document.getElementById("topEmotion");
const badgeList = document.getElementById("badgeList");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");


// =========================
// INIT APP (FONDAMENTALE)
// =========================
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  Promise.all([
    fetch("config.json").then(r => r.json()),
    fetch("messages.json").then(r => r.json()),
    fetch("categories.json").then(r => r.json()),
    fetch("emotions.json").then(r => r.json()),
    fetch("badges.json").then(r => r.json())
  ]).then(([cfg, msg, cat, emo, bad]) => {

    config = cfg;
    messages = msg;
    categoriesData = cat;
    emotionsData = emo;
    badgesData = bad;

     // default type OBBLIGATORIO
    typeSelect.value = "movement";

    // settings default
    if (!userSettings.tone) {
      userSettings.tone = config.defaultTone;
    }

    // UI init (ORA i dati esistono)
    applyTone();
    populateCategories();
    updateUI();
  });
}


// =========================
// POPULATE
// =========================

function populateCategories() {
  categorySelect.innerHTML = "";
  const type = String(typeSelect.value || "movement");
  const list = categoriesData?.[type] || [];
  if (list.length === 0) {
    console.warn("Lista vuota per:", type);
    return;
  }
  list.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}


// =========================
// LOGICA
// =========================
function isToday(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();

  return d.toDateString() === today.toDateString();
}

function calculatePoints() {
  let points = 0;

  sessions.forEach(s => {
    if (s.type === "movement") {
      points += parseFloat(s.duration) * parseFloat(config.movementMultiplier);
    } else {
      points -= parseFloat(s.duration) * parseFloat(config.devicePenalty);
    }
  });

  return points;
}

function applyTone() {
  document.body.className = userSettings.tone;
  toneButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tone === userSettings.tone);
  });
}

function getMessage() {
  const tone = userSettings.tone || config.defaultTone;
  const list = messages?.[tone] || ["..."];
  return list[Math.floor(Math.random() * list.length)];
}

function getBadges(points) {
  return badgesData
    .filter(b => points >= b.min)
    .map(b => b.label);
}

function setEmotion(index, emotionId) {
  const emotionObj = emotionsData.find(e => e.id === emotionId);
  if (!emotionObj) return;
  sessions[index].emotion = emotionObj.label; // ✅ SEMPRE label
  localStorage.setItem("sessions", JSON.stringify(sessions));
  updateUI();
}

function formatSmartDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return "Oggi";
  }
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short"
  });
}


// =========================
// STATS
// =========================

function calculateStats() {
  let move = 0;
  let device = 0;
  let emotionCount = {};

  sessions.forEach(s => {
    if (s.type === "movement") move += parseFloat(s.duration);
    else device += parseFloat(s.duration);

    if (s.emotion) {
      emotionCount[s.emotion] = (emotionCount[s.emotion] || 0) + 1;
    }

  });

  let topEmotion = "-";
  let max = 0;

  for (let emo in emotionCount) {
  if (emotionCount[emo] > max) {
    max = emotionCount[emo];
    const obj = emotionsData.find(e => e.id === emo);
    topEmotion = obj ? obj.label : emo; // ✅ emoji + testo
  }
}

  return { move, device, topEmotion };
}

// =========================
// SCREEN
// =========================

/*function goTo(screen) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });

  document.getElementById("screen-" + screen).classList.add("active");
}*/

function goTo(screen) {
  const current = document.querySelector(".screen.active");
  const next = document.getElementById("screen-" + screen);

  if (current === next) return;

  current.classList.add("exit-left");

  setTimeout(() => {
    current.classList.remove("active", "exit-left");
    next.classList.add("active");
  }, 200);
}

function vibrate(type = "light") {
  if (!navigator.vibrate) return;

  if (type === "light") navigator.vibrate(20);
  if (type === "medium") navigator.vibrate(50);
  if (type === "heavy") navigator.vibrate([50, 30, 50]);
}

// =========================
// UI UPDATE
// =========================

function updateUI() {

  const todayDateEl = document.getElementById("todayDate");
  const today = new Date();
  todayDateEl.textContent = today.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long"
});
  
  const todayList = document.getElementById("todayList");
  const historyDiv = document.getElementById("history");
  
  sessionList.innerHTML = "";
  todayList.innerHTML = "";
  historyDiv.innerHTML = "";

  sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const todaySessions = sessions.filter(s => isToday(s.date));
  const oldSessions = sessions.filter(s => !isToday(s.date));

   // 🔹 OGGI
  todaySessions.forEach((s) => {
  const realIndex = sessions.indexOf(s);
  const dateLabel = formatSmartDate(s.date);

  const li = document.createElement("li");

  const emotionHTML = s.emotion
  ? `<span class="emoji-selected">${s.emotion}</span>`
  : `
    <div class="emoji-picker">
      ${emotionsData.map(e => `
        <span onclick="setEmotion(${realIndex}, '${e.id}')">
          ${e.label}
        </span>
      `).join("")}
    </div>
  `;

  li.innerHTML = `
  <div class="session-card">
    <div class="session-top">
      <span>${formatSmartDate(s.date)}</span>
      <span>${s.duration}s</span>
    </div>

    <div class="session-main">
      <strong>${s.category}</strong>
      <small>${s.type}</small>
    </div>

    <div class="session-bottom">
      ${emotionHTML}
    </div>
  </div>
`;

  todayList.appendChild(li);
});

  // 🔹 STORICO PER GIORNO
  const grouped = {};

  oldSessions.forEach(s => {
    const day = new Date(s.date).toLocaleDateString();
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(s);
  });

  for (let day in grouped) {
    const div = document.createElement("div");

    div.innerHTML = `<h4>${day}</h4>`;

    grouped[day].forEach(s => {
        const p = document.createElement("p");
        const dateLabel = formatSmartDate(s.date);
        p.textContent = `${dateLabel} - ${s.type} - ${s.category} - ${s.duration}s ${s.emotion || ""}`;
        div.appendChild(p);
    });
    historyDiv.appendChild(div);
  }

  const points = calculatePoints();
  pointsDisplay.textContent = points.toFixed(2) + " XP";

  messageBox.textContent = getMessage();

  const stats = calculateStats();

  moveTimeEl.textContent = stats.move.toFixed(2);
  deviceTimeEl.textContent = stats.device.toFixed(2);
  topEmotionEl.textContent = stats.topEmotion;

  badgeList.innerHTML = "";
  const badges = getBadges(points);
  badges.forEach(b => {
    const li = document.createElement("li");
    li.textContent = b;
    badgeList.appendChild(li);
  });
  document.getElementById("lastBadge").textContent =
  badges.length ? "Ultimo badge: " + badges[badges.length - 1] : "";

  drawChart(stats.move, stats.device);
} 


// =========================
// CHART
// =========================

function drawChart(move, device) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const max = Math.max(move, device, 1);

  const moveHeight = (move / max) * 100;
  const deviceHeight = (device / max) * 100;

  ctx.fillStyle = "green";
  ctx.fillRect(50, 120 - moveHeight, 50, moveHeight);

  ctx.fillStyle = "red";
  ctx.fillRect(150, 120 - deviceHeight, 50, deviceHeight);

  ctx.fillStyle = "black";
  ctx.fillText("Move", 50, 140);
  ctx.fillText("Device", 150, 140);
}


// =========================
// EVENTS
// =========================


toneButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tone = btn.dataset.tone;
    userSettings.tone = tone;
    localStorage.setItem("settings", JSON.stringify(userSettings));
    applyTone();
    updateUI();
  });
});

typeSelect.addEventListener("change", populateCategories);

startBtn.addEventListener("click", () => {
  startTime = Date.now();
  stato.textContent = "In corso...";
  vibrate("light");
});

stopBtn.addEventListener("click", () => {
  if (!startTime) return;

  const durationSec = Math.floor((Date.now() - startTime) / 1000);
  const durationMin = (durationSec / 60).toFixed(2);

  const session = {
    type: typeSelect.value,
    category: categorySelect.value || "N/A",
    duration: durationMin,
    //emotion: emotionSelect.value,
    date: new Date().toISOString(), 
    emotion: null // ✅ parte senza emozione, si aggiunge dopo con il pulsante 
  };
  sessions.push(session);
  localStorage.setItem("sessions", JSON.stringify(sessions));
  startTime = null;
  stato.textContent = "Fermo";
  vibrate("medium");
  updateUI();
});

let startX = 0;

document.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
});

document.addEventListener("touchend", e => {
  let endX = e.changedTouches[0].clientX;
  let diff = startX - endX;

  if (Math.abs(diff) < 50) return;

  const screens = ["home", "session", "stats"];
  let currentIndex = screens.findIndex(s =>
    document.getElementById("screen-" + s).classList.contains("active")
  );

  if (diff > 0 && currentIndex < screens.length - 1) {
    goTo(screens[currentIndex + 1]); // swipe left
  } else if (diff < 0 && currentIndex > 0) {
    goTo(screens[currentIndex - 1]); // swipe right
  }
});

