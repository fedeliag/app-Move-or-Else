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
const toneSelect = document.getElementById("toneSelect");
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
    populateTone();
    populateCategories();
    populateEmotions();
    updateUI();
  });
}


// =========================
// POPULATE
// =========================

function populateTone() {
  toneSelect.innerHTML = "";

  config.tones.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    toneSelect.appendChild(opt);
  });

  toneSelect.value = userSettings.tone;
}

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
  

function populateEmotions() {
  emotionSelect.innerHTML = "";

  emotionsData.forEach(e => {
    const option = document.createElement("option");
    option.value = e.id;
    option.textContent = e.label;
    emotionSelect.appendChild(option);
  });
}


// =========================
// LOGICA
// =========================

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
  toneSelect.value = userSettings.tone;
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

    emotionCount[s.emotion] = (emotionCount[s.emotion] || 0) + 1;
  });

  let topEmotion = "-";
  let max = 0;

  for (let emo in emotionCount) {
    if (emotionCount[emo] > max) {
      max = emotionCount[emo];
      topEmotion = emo;
    }
  }

  return { move, device, topEmotion };
}


// =========================
// UI UPDATE
// =========================

function updateUI() {
  sessionList.innerHTML = "";

  sessions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.type} - ${s.category} - ${s.duration} min (${(s.duration*60).toFixed(1)} sec) - ${s.emotion}`;
    sessionList.appendChild(li);
  });

  const points = calculatePoints();
  pointsDisplay.textContent = points + " XP";

  messageBox.textContent = getMessage();

  const stats = calculateStats();

  moveTimeEl.textContent = stats.move.toFixed(2);
  deviceTimeEl.textContent = stats.device.toFixed(2);
  topEmotionEl.textContent = stats.topEmotion;

  badgeList.innerHTML = "";
  getBadges(points).forEach(b => {
    const li = document.createElement("li");
    li.textContent = b;
    badgeList.appendChild(li);
  });

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

toneSelect.addEventListener("change", () => {
  userSettings.tone = toneSelect.value;
  localStorage.setItem("settings", JSON.stringify(userSettings));
  applyTone();
});

typeSelect.addEventListener("change", populateCategories);

startBtn.addEventListener("click", () => {
  startTime = Date.now();
  stato.textContent = "In corso...";
});

stopBtn.addEventListener("click", () => {
  if (!startTime) return;

  const durationSec = Math.floor((Date.now() - startTime) / 1000);
  const durationMin = (durationSec / 60).toFixed(2);

  const session = {
    type: typeSelect.value,
    category: categorySelect.value || "N/A",
    duration: durationMin,
    emotion: emotionSelect.value
  };

  sessions.push(session);
  localStorage.setItem("sessions", JSON.stringify(sessions));

  startTime = null;
  stato.textContent = "Fermo";

  updateUI();
});