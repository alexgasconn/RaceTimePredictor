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

function riegel(t1, d1, d2, exponent = 1.06) {
  return t1 * Math.pow(d2 / d1, exponent);
}

function getBestPerformances(runs) {
  const best = {};
  for (const { name, km } of targetDistances) {
    const min = km * 0.95, max = km * 1.05;
    const filtered = runs.filter(r => r.distance >= min && r.distance <= max);
    if (filtered.length === 0) continue;
    const bestRun = filtered.reduce((a, b) => a.time < b.time ? a : b);
    best[km] = { name, km, time: bestRun.time, date: bestRun.date };
  }
  return best;
}

function trainMLModel(best) {
  const X = [], Y = [];
  Object.values(best).forEach(({ km, time }) => {
    X.push(Math.log(km));
    Y.push(time);
  });

  const n = X.length;
  if (n < 2) return null;

  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumXY = 0, sumX2Y = 0;

  for (let i = 0; i < n; i++) {
    const x = X[i], x2 = x * x, y = Y[i];
    sumX += x; sumX2 += x2; sumX3 += x2 * x; sumX4 += x2 * x2;
    sumY += y; sumXY += x * y; sumX2Y += x2 * y;
  }

  const A = [
    [n, sumX, sumX2],
    [sumX, sumX2, sumX3],
    [sumX2, sumX3, sumX4]
  ];
  const B = [sumY, sumXY, sumX2Y];

  let coeffs;
  try {
    coeffs = math.lusolve(A, B).map(r => r[0]);
  } catch (e) {
    console.error("ML model failed", e);
    return null;
  }

  const [a, b, c] = coeffs;

  const residuals = Y.map((y, i) => {
    const xi = X[i];
    return y - (a + b * xi + c * xi ** 2);
  });
  const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);

  return { a, b, c, stdDev };
}

function predictAll(best, model) {
  const results = [];

  for (const { name, km } of targetDistances) {
    const riegelPreds = [];
    Object.values(best).forEach(({ km: fromKm, time }) => {
      if (fromKm === km) return;
      const pred = riegel(time, fromKm, km);
      riegelPreds.push(pred);
    });

    const avgRiegel = riegelPreds.length
      ? riegelPreds.reduce((a, b) => a + b, 0) / riegelPreds.length
      : null;

    const logKm = Math.log(km);
    const mlTime = model
      ? model.a + model.b * logKm + model.c * logKm * logKm
      : null;

      const relativeFactor = km / 5; // más ancho para 10K, 21K, etc.
      const ciLow = mlTime - 1.96 * model.stdDev * relativeFactor;
      const ciHigh = mlTime + 1.96 * model.stdDev * relativeFactor;

    // 👇 Combinación con mejor marca real si existe
    let combined = null;
    const values = [avgRiegel, mlTime];
    if (best[km]) values.push(best[km].time);
    const valid = values.filter(v => v !== null && !isNaN(v));
    if (valid.length > 0) {
      combined = valid.reduce((a, b) => a + b, 0) / valid.length;
    }

    if (combined !== null) {
      let reliability = null;
      if (best[km]) {
        const real = best[km].time;
        const errorPerKm = Math.abs(combined - real) / km;
        const penalty = 0.25;
        reliability = Math.max(0, 100 * Math.exp(-errorPerKm / penalty));
      }

      results.push({
        name,
        combined,
        riegel: avgRiegel,
        ml: mlTime,
        bestTime: best[km]?.time || null,
        ciLow,
        ciHigh,
        reliability
      });
      
    }
  }

  return results;
}


function formatMinutes(min) {
  const totalSec = Math.round(min * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function displayPredictions(results) {
  const ul = document.getElementById("results");
  ul.innerHTML = "";

  results.forEach(({ name, combined, ml, riegel, ciLow, ciHigh, reliability }) => {
    const formattedPred = formatMinutes(combined);
    const formattedLow = formatMinutes(ciLow);
    const formattedHigh = formatMinutes(ciHigh);

    const pace = combined / targetDistances.find(d => d.name === name).km;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60).toString().padStart(2, "0");

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${name}</strong>: ${formattedPred}<br>
      Estimated Range: <em>${formattedLow} ~ ${formattedHigh}</em><br>
      Pace: ${paceMin}:${paceSec} min/km<br>
      Riegel: ${Math.round(riegel)} min<br>
      ML: ${Math.round(ml)} min<br>
      Confidence: <strong>${Math.round(reliability)}%</strong>
    `;
    ul.appendChild(li);
  });
}


document.getElementById("csv-file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const runs = results.data
        .filter(r => r["Activity Type"] === "Run")
        .map(r => ({
          distance: parseFloat(r["Distance"]),
          time: parseTimeToMinutes(r["Elapsed Time"]),
          date: r["Activity Date"]
        }))
        .filter(r => !isNaN(r.distance) && !isNaN(r.time));

      const best = getBestPerformances(runs);
      const model = trainMLModel(best);
      const preds = predictAll(best, model);

      if (!preds.length) {
        alert("No valid predictions could be made.");
        return;
      }

      displayPredictions(preds);
    }
  });
});
