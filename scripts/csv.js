const targetDistances = [
  { name: "Mile", km: 1.609 },
  { name: "5K", km: 5.0 },
  { name: "10K", km: 10.0 },
  { name: "Half Marathon", km: 21.097 },
  { name: "Marathon", km: 42.195 }
];

function parseTimeToMinutes(str) {
  if (!str) return NaN;
  const parts = str.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (!isNaN(Number(str))) return Number(str) / 60;
  return NaN;
}

function processStravaCSV(data) {
  const lines = data.trim().split("\n").filter(line => line.trim() !== '');
  if (lines.length < 2) return {};

  const header = lines[0].split(",").map(h => h.trim());
  const idxType = header.indexOf("Activity Type");
  const idxDist = header.indexOf("Distance");
  const idxTime = header.indexOf("Elapsed Time");
  const idxDate = header.indexOf("Activity Date");

  console.log("Detected columns:", { idxType, idxDist, idxTime, idxDate });

  if ([idxType, idxDist, idxTime, idxDate].includes(-1)) {
    console.error("Missing one or more required columns in CSV header.");
    return {};
  }

  const runs = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map(cell => cell.trim());

    if (row.length <= Math.max(idxType, idxDist, idxTime, idxDate)) {
      console.warn(`Skipping malformed row at line ${i + 1}`);
      continue;
    }

    const type = row[idxType];
    if (type !== "Run") continue;

    const distance = parseFloat(row[idxDist]);
    const time = parseTimeToMinutes(row[idxTime]);
    const date = row[idxDate];

    if (isNaN(distance) || isNaN(time)) {
      console.warn(`Skipping invalid run at line ${i + 1}:`, row);
      continue;
    }

    runs.push({ distance, time, date });
  }

  const bestTimes = {};
  for (const { name, km } of targetDistances) {
    const minDist = km * 0.95;
    const maxDist = km * 1.05;
    const candidates = runs.filter(r => r.distance >= minDist && r.distance <= maxDist);
    if (candidates.length === 0) continue;

    const best = candidates.reduce((a, b) => a.time < b.time ? a : b);
    bestTimes[km] = { time: best.time, date: best.date };
  }

  return bestTimes;
}

function predictFromBestTimes(bestTimes) {
  const X = [], Y = [];

  for (let km in bestTimes) {
    X.push(Math.log(parseFloat(km)));
    Y.push(bestTimes[km].time);
  }

  if (X.length < 2) return [];

  const n = X.length;
  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumXY = 0, sumX2Y = 0;

  for (let i = 0; i < n; i++) {
    const x = X[i], x2 = x * x, y = Y[i];
    sumX += x;
    sumX2 += x2;
    sumX3 += x2 * x;
    sumX4 += x2 * x2;
    sumY += y;
    sumXY += x * y;
    sumX2Y += x2 * y;
  }

  const A = [
    [n, sumX, sumX2],
    [sumX, sumX2, sumX3],
    [sumX2, sumX3, sumX4]
  ];
  const B = [sumY, sumXY, sumX2Y];

  let coeffs;
  try {
    coeffs = math.lusolve(A, B).map(x => x[0]);
  } catch (err) {
    console.error("Matrix solving failed:", err);
    return [];
  }

  const [a, b, c] = coeffs;
  const residuals = Y.map((y, i) => y - (a + b * X[i] + c * X[i] ** 2));
  const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);

  return targetDistances.map(({ name, km }) => {
    const logKm = Math.log(km);
    const pred = a + b * logKm + c * logKm * logKm;
    return {
      name,
      minutes: pred,
      lower: pred - 1.96 * stdDev,
      upper: pred + 1.96 * stdDev
    };
  });
}

function displayPredictions(preds) {
  const list = document.getElementById("results");
  list.innerHTML = "";
  preds.forEach(({ name, minutes, lower, upper }) => {
    const totalSec = Math.round(minutes * 60);
    const pace = minutes / targetDistances.find(d => d.name === name).km;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60).toString().padStart(2, "0");

    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${name}</strong>: ${Math.floor(totalSec / 60)}m ${totalSec % 60}s<br>
      Pace: ${paceMin}:${paceSec} min/km<br>
      95% CI: ${Math.round(lower)} – ${Math.round(upper)} min
    `;
    list.appendChild(item);
  });
}

document.getElementById("csv-file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    alert("No file selected. Please select a CSV file.");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      try {
        const parsed = results.data;
        const runs = parsed.filter(r => r["Activity Type"] === "Run");

        const cleaned = runs.map(r => {
          return {
            distance: parseFloat(r["Distance"]),
            time: parseTimeToMinutes(r["Elapsed Time"]),
            date: r["Activity Date"]
          };
        }).filter(r => !isNaN(r.distance) && !isNaN(r.time));

        const bestTimes = {};
        for (const { name, km } of targetDistances) {
          const minDist = km * 0.95;
          const maxDist = km * 1.05;
          const candidates = cleaned.filter(r => r.distance >= minDist && r.distance <= maxDist);
          if (candidates.length === 0) continue;
          const best = candidates.reduce((a, b) => a.time < b.time ? a : b);
          bestTimes[km] = { time: best.time, date: best.date };
        }

        const preds = predictFromBestTimes(bestTimes);
        if (preds.length === 0) {
          alert("No valid runs found.");
        } else {
          displayPredictions(preds);
        }
      } catch (err) {
        console.error("Failed to process parsed CSV:", err);
        alert("Something went wrong processing the file.");
      }
    }
  });
});

