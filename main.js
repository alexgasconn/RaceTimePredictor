const targetDistances = [
  { name: "Mile (1.609 km)", km: 1.609 },
  { name: "5K", km: 5 },
  { name: "10K", km: 10 },
  { name: "Half Marathon", km: 21.097 },
  { name: "Marathon", km: 42.195 },
];

function parseDuration(duration) {
  if (!duration || typeof duration !== "string") return null;
  const parts = duration.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return null;
}

function processStravaCSV(data) {
  const lines = data.split("\n");
  const header = lines[0].split(",");
  const idxType = header.indexOf("Activity Type");
  const idxDist = header.indexOf("Distance");
  const idxTime = header.indexOf("Elapsed Time");
  const idxDate = header.indexOf("Activity Date");

  const bestTimes = {};

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const type = row[idxType];
    const dist = parseFloat(row[idxDist]);
    const time = parseFloat(row[idxTime]);
    const date = row[idxDate];
    if (type !== "Run" || isNaN(dist) || isNaN(time)) continue;

    targetDistances.forEach(({ name, km }) => {
      if (dist >= km * 0.95 && dist <= km * 1.05) {
        if (!bestTimes[km] || bestTimes[km].time > time) {
          bestTimes[km] = { time: time / 60, date }; // in minutes
        }
      }
    });
  }

  return bestTimes;
}

function predictFromBestTimes(bestTimes) {
  const xs = [], ys = [];
  for (let km in bestTimes) {
    xs.push(Math.log(parseFloat(km)));
    ys.push(bestTimes[km].time);
  }

  const X = xs, Y = ys, n = X.length;
  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumXY = 0, sumX2Y = 0;

  for (let i = 0; i < n; i++) {
    const x = X[i];
    const x2 = x * x;
    sumX += x;
    sumX2 += x2;
    sumX3 += x2 * x;
    sumX4 += x2 * x2;
    sumY += Y[i];
    sumXY += x * Y[i];
    sumX2Y += x2 * Y[i];
  }

  const A = [
    [n, sumX, sumX2],
    [sumX, sumX2, sumX3],
    [sumX2, sumX3, sumX4]
  ];
  const B = [sumY, sumXY, sumX2Y];
  const [a, b, c] = math.lusolve(A, B).map(x => x[0]);

  const residuals = Y.map((y, i) => y - (a + b * X[i] + c * X[i] * X[i]));
  const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);

  return targetDistances.map(({ name, km }) => {
    const x = Math.log(km);
    const y = a + b * x + c * x * x;
    return {
      name,
      minutes: y,
      lower: y - 1.96 * stdDev,
      upper: y + 1.96 * stdDev,
    };
  });
}

function displayPredictions(predictions) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  predictions.forEach(({ name, minutes, lower, upper }) => {
    const pace = minutes / targetDistances.find(d => d.name === name).km;
    const totalSec = minutes * 60;
    const min = Math.floor(totalSec / 60);
    const sec = Math.round(totalSec % 60);
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);

    results.innerHTML += `
      <li>
        <strong>${name}:</strong> ${min}m ${sec}s<br>
        Pace: <em>${paceMin}:${paceSec.toString().padStart(2, "0")} min/km</em><br>
        95% CI: ${Math.floor(lower)}–${Math.ceil(upper)} min
      </li>
    `;
  });
}

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const content = e.target.result;
    const best = processStravaCSV(content);
    if (Object.keys(best).length < 2) {
      alert("Not enough data from CSV. Add more races or switch to manual input.");
      return;
    }
    const preds = predictFromBestTimes(best);
    displayPredictions(preds);
  };
  reader.readAsText(file);
}

function calculatePredictions() {
  const userTimes = {};
  document.querySelectorAll(".distance-group").forEach((group) => {
    const distAttr = group.getAttribute("data-distance");
    const dist = parseFloat(distAttr);
    const inputs = group.querySelectorAll("input");
    let times = [];
    for (let i = 0; i < inputs.length; i += 2) {
      const time = parseDuration(inputs[i].value.trim());
      const date = inputs[i + 1].value;
      if (time) times.push({ time, date });
    }
    if (times.length) userTimes[dist] = times;
  });

  const predictions = {};
  targetDistances.forEach(({ name, km }) => {
    let allPredictions = [];
    for (let from in userTimes) {
      if (parseFloat(from) === km) continue;
      userTimes[from].forEach(({ time, date }) => {
        const predicted = riegel(time, parseFloat(from), km);
        const ageFactor = 1 / (1 + ((new Date() - new Date(date)) / (1000 * 60 * 60 * 24 * 365)));
        allPredictions.push({ value: predicted, weight: ageFactor });
      });
    }
    if (allPredictions.length) {
      const total = allPredictions.reduce((s, x) => s + x.value * x.weight, 0);
      const wsum = allPredictions.reduce((s, x) => s + x.weight, 0);
      predictions[name] = total / wsum;
    }
  });

  const formatted = Object.entries(predictions).map(([name, minutes]) => ({
    name,
    minutes,
    lower: minutes * 0.97,
    upper: minutes * 1.03
  }));

  displayPredictions(formatted);
}

function initModeSelector() {
  const selector = document.getElementById("mode-selector");
  selector.addEventListener("change", (e) => {
    const mode = e.target.value;
    document.getElementById("manual-inputs").style.display = mode === "manual" ? "block" : "none";
    document.getElementById("csv-upload").style.display = mode === "csv" ? "block" : "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initModeSelector();
  document.getElementById("csv-file").addEventListener("change", handleCSVUpload);
});
