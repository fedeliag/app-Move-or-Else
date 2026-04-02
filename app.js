let sessions = JSON.parse(localStorage.getItem("sessions")) || [];

let startTime = null;

// elementi DOM
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const typeSelect = document.getElementById("type");
const sessionList = document.getElementById("sessionList");
const pointsDisplay = document.getElementById("points");

// START
startBtn.addEventListener("click", () => {
  startTime = Date.now();
  status.textContent = "In corso...";
});

// STOP
stopBtn.addEventListener("click", () => {
  if (!startTime) return;

  const endTime = Date.now();
  const duration = Math.floor((endTime - startTime) / 60000);

  const session = {
    type: typeSelect.value,
    duration: duration
  };

  sessions.push(session);
  localStorage.setItem("sessions", JSON.stringify(sessions));

  startTime = null;
  status.textContent = "Fermo";

  updateUI();
});

// CALCOLO PUNTI
function calculatePoints() {
  let points = 0;

  sessions.forEach(s => {
    if (s.type === "movement") {
      points += s.duration;
    } else {
      points -= s.duration;
    }
  });

  return points;
}

// UI
function updateUI() {
  sessionList.innerHTML = "";

  sessions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.type} - ${s.duration} min`;
    sessionList.appendChild(li);
  });

  pointsDisplay.textContent = calculatePoints();
}

// INIT
updateUI();