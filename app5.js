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
const streakEl=document.getElementById("streak");
const emotionScoreEl=document.getElementById("emotionScore");
const levelEl=document.getElementById("level");
const badgeList = document.getElementById("badgeList");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

const colors = {
  movement: ["#4CAF50", "#81C784", "#A5D6A7"],
  device: ["#F44336", "#E57373", "#EF9A9A"]
};


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

//old
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

function calculateSessionPoints(session) {
  if (session.type === "movement") {
    return session.duration * config.movementMultiplier;
  } else {
    return -session.duration * config.devicePenalty;
  }
}

function applyTone() {
  document.body.className = userSettings.tone;
  toneButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tone === userSettings.tone);
  });
}

//Old 
  function getMessage() {
  const tone = userSettings.tone || config.defaultTone;
  const list = messages?.[tone] || ["..."];
  return list[Math.floor(Math.random() * list.length)];
}

function getStatusMessage(points) {
  const level = calculateLevel(points);
  let type = "status_low";
  if (points >= 100) type = "status_mid";
  if (points >= 300) type = "status_high";
  return getStructuredMessage(type, {
    points: points.toFixed(0),
    level: level
  });
}

//old
function getProgressMessage() {
  const goal = config.dailyGoal;
  const current = getTodayMovement();
  if (current >= goal) return "goal_completed";
  if (current >= goal * 0.5) return "halfway";
  return "start";
}

function getStructuredMessage(type, vars = {}) {
  const tone = userSettings.tone || config.defaultTone;
  let pool = messages?.[tone]?.[type] || ["..."];
  let msg = pool[Math.floor(Math.random() * pool.length)];
  Object.keys(vars).forEach(key => {
    msg = msg.replace(`{${key}}`, vars[key]);
  });
  return msg;
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

function calculateStreak() {
  const days = [...new Set(sessions.map(s =>
    new Date(s.date).toDateString()
  ))].sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  let current = new Date();
  for (let day of days) {
    const d = new Date(day);
    if (d.toDateString() === current.toDateString()) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function calculateEmotionScore() {
  let score = 0;
  sessions.forEach(s => {
    const emo = emotionsData.find(e => e.label === s.emotion);
    if (emo) score += emo.weight;
  });
  return score;
}

function calculateLevel(points) {
  return Math.floor(points / 100);
}

function getTodayMovement() {
  return sessions
    .filter(s => isToday(s.date) && s.type === "movement")
    .reduce((sum, s) => sum + parseFloat(s.duration), 0);
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

const navButtons = document.querySelectorAll(".nav-btn");

let currentScreenIndex = 0;
const screens = ["home", "session", "stats"];

function goTo(screen) {
  const newIndex = screens.indexOf(screen);
  const current = document.querySelector(".screen.active");
  const next = document.getElementById("screen-" + screen);

  if (!next || current === next) return;

  // animazione semplice senza timeout
  next.classList.add("active");
  current.classList.remove("active");

  currentScreenIndex = newIndex;

  // update nav active
  navButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === screen);
  });
}

/*function goTo(screen) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });

  document.getElementById("screen-" + screen).classList.add("active");
}*/
/*function goTo(screen) {
  const current = document.querySelector(".screen.active");
  const next = document.getElementById("screen-" + screen);

  if (current === next) return;

  current.classList.add("exit-left");

  setTimeout(() => {
    current.classList.remove("active", "exit-left");
    next.classList.add("active");
  }, 200);
} */


function vibrate(type = "light") {
  if (!("vibrate" in navigator)) {
    console.log("Vibrazione non supportata");
    return;
  }

  if (type === "light") navigator.vibrate(30);
  if (type === "medium") navigator.vibrate(60);
  if (type === "heavy") navigator.vibrate([80, 40, 80]);
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
      <span>${s.duration} min</span>
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
        p.textContent = `${dateLabel} - ${s.type} - ${s.category} - ${s.duration} min ${s.emotion || ""}`;
        div.appendChild(p);
    });
    historyDiv.appendChild(div);
  }

  let points = calculatePoints();
  pointsDisplay.textContent = points.toFixed(2) + " XP";

  const progressType = getProgressMessage();
  const progressMsg = getStructuredMessage(progressType);

  //messageBox.textContent = progressMsg;
  messageBox.textContent = getStatusMessage(points);
  //messageBox.textContent = getMessage();

  let stats = calculateStats();

  const streak = calculateStreak();
  const emotionScore = calculateEmotionScore();
  const level = calculateLevel(points);

  moveTimeEl.textContent = stats.move.toFixed(2) +" min";
  deviceTimeEl.textContent = stats.device.toFixed(2) +" min";
  topEmotionEl.textContent = stats.topEmotion;

  streakEl.textContent = streak + " 🔥";
  emotionScoreEl.textContent = emotionScore;
  levelEl.textContent = "Lv. " + level;

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

function getCategoryBreakdown() {
  const data = {};

  sessions.forEach(s => {
    const key = `${s.type}_${s.category}`;

    if (!data[key]) {
      data[key] = {
        type: s.type,
        category: s.category,
        total: 0
      };
    }

    data[key].total += parseFloat(s.duration);
  });

  return Object.values(data);
}

function getColor(type, index) {
  return colors[type][index % colors[type].length];
}

function drawPieChart() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const data = getCategoryBreakdown();
  const total = data.reduce((sum, d) => sum + d.total, 0);

  let startAngle = 0;

  let colorIndex = {
    movement: 0,
    device: 0
  };

  data.forEach(d => {
    const sliceAngle = (d.total / total) * 2 * Math.PI;

    const index = colorIndex[d.type]++;
    const color = getColor(d.type, index);

    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.arc(100, 100, 80, startAngle, startAngle + sliceAngle);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // 🔥 salva index invece del colore
    d._colorIndex = index;

    startAngle += sliceAngle;
  });

  drawLegend(data);
}

/*function drawChart(move, device) {
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
}*/

function drawLegend(data) {
  const legend = document.getElementById("legend");
  legend.innerHTML = "";

  data.forEach(d => {
    const div = document.createElement("div");

    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.marginBottom = "6px";

    const colorBox = document.createElement("span");
    colorBox.style.width = "12px";
    colorBox.style.height = "12px";
    colorBox.style.marginRight = "6px";
    colorBox.style.borderRadius = "3px";

    // 🔥 colore ricostruito
    colorBox.style.background = getColor(d.type, d._colorIndex);

    const label = document.createElement("span");
    let totalc= 0;
    
    data.forEach(d => {
      totalc += d.total;
  });
    if (totalc === 0) totalc = 1; // evita divisione per zero
    label.textContent = `${d.category} (${(d.total/totalc * 100).toFixed(1)}%)`;

    div.appendChild(colorBox);
    div.appendChild(label);

    legend.appendChild(div);
  });
}

function drawChart(move, device) {
  drawPieChart();
}


// =========================
// EVENTS
// =========================

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const screen = btn.dataset.screen;
    goTo(screen);
  });
});

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
    duration: parseFloat(durationMin),
    date: new Date().toISOString(),
    emotion: null
  };
  const sessionPoints = calculateSessionPoints(session);
  sessions.push(session);
  localStorage.setItem("sessions", JSON.stringify(sessions));
  startTime = null;
  vibrate("medium");
  const streak = calculateStreak();
  const type = sessionPoints >= 0
    ? "session_positive"
    : "session_negative";
  stato.textContent ="Fermo - " + getStructuredMessage(type, {
    points: Math.abs(sessionPoints.toFixed(1)),
    streak: streak
  });
  updateUI();
});


/*
let startX = 0;
let startY = 0;

document.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", e => {
  const endX = e.changedTouches[0].clientX;
  const endY = e.changedTouches[0].clientY;

  const diffX = startX - endX;
  const diffY = startY - endY;

  // ❗ evita swipe verticale
  if (Math.abs(diffX) < Math.abs(diffY)) return;

  // ❗ soglia minima
  if (Math.abs(diffX) < 60) return;

  const screens = ["home", "session", "stats"];
  const currentIndex = screens.findIndex(s =>
    document.getElementById("screen-" + s).classList.contains("active")
  );

  if (diffX > 0 && currentIndex < screens.length - 1) {
    goTo(screens[currentIndex + 1]); // ← swipe left
  } else if (diffX < 0 && currentIndex > 0) {
    goTo(screens[currentIndex - 1]); // → swipe right
  }
}, { passive: true });
*/
