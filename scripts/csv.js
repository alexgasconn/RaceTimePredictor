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
    const sorted = filtered.sort((a, b) => a.time - b.time);
    best[km] = sorted.slice(0, 3).map(r => ({ ...r, km }));
  }
  return best;
}

function trainMLModel(best) {
  const flatBest = Object.values(best).flat();
  const X = flatBest.map(r => Math.log(r.km));
  const Y = flatBest.map(r => r.time);

  if (X.length < 2) return null;

  const n = X.length;
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

  const coeffs = math.lusolve(A, B).map(r => r[0]);
  const [a, b, c] = coeffs;

  const residuals = Y.map((y, i) => {
    const xi = X[i];
    return y - (a + b * xi + c * xi ** 2);
  });
  const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);

  return { a, b, c, stdDev };
}

function predictForEveryKm(best, model) {
  const kmPoints = [];
  for (let km = 1; km <= 42; km++) {
    let predictions = [];

    // Riegel from all performances
    Object.entries(best).forEach(([fromKmStr, entries]) => {
      const fromKm = parseFloat(fromKmStr);
      if (fromKm === km) return;
      entries.forEach(({ time }) => {
        const pred = riegel(time, fromKm, km);
        const weight = 1 / Math.pow(time / fromKm, 2);
        predictions.push({ time: pred, weight });
      });
    });

    // ML + stddev
    if (model) {
      const logKm = Math.log(km);
      const mlTime = model.a + model.b * logKm + model.c * logKm ** 2;
      predictions.push({ time: mlTime, weight: 2 });
      predictions.push({ time: mlTime + model.stdDev * (km / 5), weight: 1 });
      predictions.push({ time: mlTime - model.stdDev * (km / 5), weight: 1 });
    }

    // Real times if available
    if (best[km]) {
      best[km].forEach(({ time }) => {
        predictions.push({ time, weight: 3 });
      });
    }

    // Percentile 25–75 trimming.
    const sorted = predictions.map(p => p.time).sort((a, b) => a - b);
    const start = Math.floor(sorted.length * 0.40);
    const end = Math.ceil(sorted.length * 0.60);
    const central = sorted.slice(start, end);

    const time = central.length
      ? central.reduce((a, b) => a + b, 0) / central.length
      : null;

    if (time) kmPoints.push({ km, time });
  }

  return kmPoints;
}



function predictAll(best, model, lowPercentile = 0.4, highPercentile = 0.6) {

  const results = [];

  for (const { name, km } of targetDistances) {
    let predictions = [];

    // Riegel predictions from all known performances
    Object.entries(best).forEach(([fromKmStr, entries]) => {
      const fromKm = parseFloat(fromKmStr);
      if (fromKm === km) return;
      entries.forEach(({ time }) => {
        const pred = riegel(time, fromKm, km);
        const weight = 1 / Math.pow(time / fromKm, 2);
        predictions.push({ time: pred, weight });
      });
    });

    // ML predictions ± stddev
    if (model) {
      const logKm = Math.log(km);
      const mlTime = model.a + model.b * logKm + model.c * logKm ** 2;
      predictions.push({ time: mlTime, weight: 2 });
      predictions.push({ time: mlTime + model.stdDev * (km / 5), weight: 1 });
      predictions.push({ time: mlTime - model.stdDev * (km / 5), weight: 1 });
    }

    // Real best times
    if (best[km]) {
      best[km].forEach(({ time }) => predictions.push({ time, weight: 3 }));
    }

    if (predictions.length === 0) continue;

    // Trimmed predictions: 25th–75th percentiles
    const sorted = predictions.slice().sort((a, b) => a.time - b.time);
    const len = sorted.length;
    const start = Math.floor(sorted.length * lowPercentile);
    const end = Math.ceil(sorted.length * highPercentile);
    const trimmed = sorted.slice(start, end);

    const trimmedWeight = trimmed.reduce((acc, p) => acc + p.weight, 0);
    const combined = trimmed.reduce((acc, p) => acc + p.time * p.weight, 0) / trimmedWeight;

    const ciLow = Math.min(...trimmed.map(p => p.time));
    const ciHigh = Math.max(...trimmed.map(p => p.time));

    let reliability = null;
    if (best[km]) {
      const real = best[km][0].time;
      const errorPerKm = Math.abs(combined - real) / km;
      const penalty = 0.25;
      reliability = Math.max(0, 100 * Math.exp(-errorPerKm / penalty));
    }

    results.push({
      name,
      km,
      combined,
      predictions: trimmed.map(p => p.time),
      ciLow,
      ciHigh,
      reliability
    });
  }

  return results;
}


function formatMinutes(min) {
  if (!isFinite(min)) return "–:–";
  const totalSec = Math.round(min * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function displayPredictions(results) {
  const ul = document.getElementById("results");
  ul.innerHTML = "";

  results.forEach(({ name, combined, ciLow, ciHigh, reliability }) => {
    const formattedPred = formatMinutes(combined);
    const formattedLow = formatMinutes(ciLow);
    const formattedHigh = formatMinutes(ciHigh);

    const pace = combined / targetDistances.find(d => d.name === name).km;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60).toString().padStart(2, "0");

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${name}</strong>: ${formattedPred}<br>
      Range: <em>${formattedLow} ~ ${formattedHigh}</em><br>
      Pace: ${paceMin}:${paceSec} min/km<br>
      Confidence (%): <strong>${Math.round(reliability ?? 0)}%</strong>
    `;
    ul.appendChild(li);
  });
}

function plotPaceChart(results, smoothedPaceData) {
  const ctx = document.getElementById("paceChart").getContext("2d");

  // 🔵 Filtramos solo predicciones válidas
  const validResults = results.filter(r => r.combined && r.predictions && r.predictions.length);

  const mainPaces = validResults.map(r => ({ x: r.km, y: r.combined / r.km }));
  const minPaces = validResults.map(r => ({ x: r.km, y: Math.min(...r.predictions) / r.km }));
  const maxPaces = validResults.map(r => ({ x: r.km, y: Math.max(...r.predictions) / r.km }));
  const smoothPoints = smoothedPaceData.map(d => ({ x: d.km, y: d.time / d.km }));


  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Prediction Range (Lower)',
          data: minPaces,
          borderColor: 'transparent',
          backgroundColor: 'rgba(0, 0, 255, 0.1)',
          pointRadius: 0,
          fill: '+1'  // 🟢 Rellena hacia arriba (a la siguiente línea: maxPaces)
        },
        {
          label: 'Prediction Range (Upper)',
          data: maxPaces,
          borderColor: 'transparent',
          backgroundColor: 'rgba(0, 0, 255, 0.1)',
          pointRadius: 0,
          fill: '-1'  // 🟢 Rellena hacia abajo (a la anterior línea: minPaces)
        },
        {
          label: 'Predicted Key Distances',
          data: mainPaces,
          borderColor: 'blue',
          backgroundColor: 'blue',
          pointRadius: 5,
          tension: 0.2,
          fill: false
        }
      ]
    }
    ,
    options: {
      responsive: true,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const pace = ctx.parsed.y;
              const min = Math.floor(pace);
              const sec = Math.round((pace - min) * 60).toString().padStart(2, "0");
              return `${ctx.dataset.label}: ${min}:${sec} min/km`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Distance (km)' },
          min: 0,
          max: 43
        },
        y: {
          title: { display: true, text: 'Pace (min/km)' },
          suggestedMin: 3,
          suggestedMax: 7
        }
      }
    }
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
      const rangeStr = document.getElementById("percentile-range").value;
      const [lowP, highP] = rangeStr.split("-").map(parseFloat);

      const preds = predictAll(best, model, lowP, highP);
      const smoothed = predictForEveryKm(best, model, lowP, highP);


      
      if (!preds.length) {
        alert("No valid predictions could be made.");
        return;
      }
      
      displayPredictions(preds);
      plotPaceChart(preds, smoothed);

    }
  });
});
