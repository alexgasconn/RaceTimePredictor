const targetDistances = [
  { name: "Mile (1.609 km)", km: 1.609 },
  { name: "5K", km: 5 },
  { name: "10K", km: 10 },
  { name: "Half Marathon", km: 21.097 },
  { name: "Marathon", km: 42.195 },
];

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
    if (!row[idxType] || row[idxType] !== "Run") continue;

    const dist = parseFloat(row[idxDist]);
    const time = parseFloat(row[idxTime]);
    const date = row[idxDate];

    if (isNaN(dist) || isNaN(time)) continue;

    for (const { km } of targetDistances) {
      if (dist >= km * 0.95 && dist <= km * 1.05) {
        if (!bestTimes[km] || bestTimes[km].time > time) {
          bestTimes[km] = { time: time / 60, date }; // time in minutes
        }
      }
    }
  }
  return bestTimes;
}

function predictFromBestTimes(bestTimes) {
  const X = [], Y = [];
  for (let km in bestTimes) {
    X.push(Math.log(parseFloat(km)));
    Y.push(bestTimes[km].time);
  }

  const n = X.length;
  if (n < 2) return [];

  // Cuadrática: y = a + b log(x) + c log(x)^2
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
    [sumX2, sumX3, sumX4],
  ];
  const B = [sumY, sumXY, sumX2Y];
  const [a, b, c] = math.lusolve(A, B).map(x => x[0]);

  const residuals = Y.map((y, i) => y - (a + b * X[i] + c * X[i] ** 2));
  const stdDev = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / n);

  return targetDistances.map(({ name, km }) => {
    const logKm = Math.log(km);
    const time = a + b * logKm + c * logKm ** 2;
    return {
      name,
      minutes: time,
      lower: time - 1.96 * stdDev,
      upper: time + 1.96 * stdDev,
    };
  });
}

function displayPredictions(preds) {
  const list = document.getElementById("results");
  list.innerHTML = "";

  preds.forEach(({ name, minutes, lower, upper }) => {
    const sec = Math.round(minutes * 60);
    const pace = minutes / targetDistances.find(d => d.name === name).km;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);

    list.innerHTML += `
      <li>
        <strong>${name}:</strong> ${Math.floor(sec / 60)}m ${sec % 60}s<br>
        Pace: ${paceMin}:${paceSec.toString().padStart(2, "0")} min/km<br>
        95% CI: ${Math.round(lower)} – ${Math.round(upper)} min
      </li>
    `;
  });
}

document.getElementById("csv-file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const best = processStravaCSV(content);
    const preds = predictFromBestTimes(best);
    if (preds.length === 0) {
      alert("Not enough valid running activities in the CSV.");
    } else {
      displayPredictions(preds);
    }
  };
  reader.readAsText(file);
});
