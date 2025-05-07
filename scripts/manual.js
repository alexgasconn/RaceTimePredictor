function parseDuration(duration) {
  if (!duration || typeof duration !== "string") return null;
  const parts = duration.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return null;
}

function formatMinutes(min) {
  if (!isFinite(min)) return "–:–";
  const totalSec = Math.round(min * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function riegel(time, fromDist, toDist) {
  return time * Math.pow(toDist / fromDist, 1.06);
}

const keyDistances = [
  { name: "Mile", km: 1.609 },
  { name: "5K", km: 5 },
  { name: "10K", km: 10 },
  { name: "Half Marathon", km: 21.095 },
  { name: "Marathon", km: 42.195 }
];

function calculatePredictions() {
  const entries = [];

  document.querySelectorAll(".distance-group").forEach(group => {
    const distAttr = group.getAttribute("data-distance");
    const inputs = group.querySelectorAll("input");

    if (distAttr === "custom") {
      const dist = parseFloat(inputs[0].value);
      const time = parseDuration(inputs[1].value);
      const date = inputs[2].value;
      if (!isNaN(dist) && time) entries.push({ dist, time, date });
    } else {
      const dist = parseFloat(distAttr);
      const time = parseDuration(inputs[0].value);
      const date = inputs[1].value;
      if (time) entries.push({ dist, time, date });
    }
  });

  const predictions = keyDistances.map(({ name, km }) => {
    const all = [];

    entries.forEach(({ dist, time, date }) => {
      const daysAgo = date ? (new Date() - new Date(date)) / (1000 * 60 * 60 * 24) : 365;
      const weight = 1 / (1 + daysAgo / 365);

      if (Math.abs(dist - km) < 0.3) {
        all.push({ time, weight }); // Real value
      } else {
        const pred = riegel(time, dist, km);
        all.push({ time: pred, weight });
      }
    });

    if (!all.length) return null;

    const sorted = all.sort((a, b) => a.time - b.time);
    const lower = Math.floor(sorted.length * 0.4);
    const upper = Math.ceil(sorted.length * 0.6);
    const trimmed = sorted.slice(lower, upper);

    const totalWeight = trimmed.reduce((acc, p) => acc + p.weight, 0);
    const combined = trimmed.reduce((acc, p) => acc + p.time * p.weight, 0) / totalWeight;
    const ciLow = Math.min(...trimmed.map(p => p.time));
    const ciHigh = Math.max(...trimmed.map(p => p.time));

    return { name, km, combined, ciLow, ciHigh };
  }).filter(Boolean);

  // Update results
  const ul = document.getElementById("results");
  ul.innerHTML = "";
  predictions.forEach(({ name, combined, ciLow, ciHigh, km }) => {
    const pace = combined / km;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60).toString().padStart(2, "0");

    ul.innerHTML += `
      <li>
        <strong>${name}</strong>: ${formatMinutes(combined)}<br>
        Range: <em>${formatMinutes(ciLow)} ~ ${formatMinutes(ciHigh)}</em><br>
        Pace: ${paceMin}:${paceSec} min/km
      </li>
    `;
  });

  plotManualChart(predictions);
}

function plotManualChart(predictions) {
  const ctx = document.getElementById("paceChart").getContext("2d");

  const paceMain = predictions.map(p => ({ x: p.km, y: p.combined / p.km }));
  const paceMin = predictions.map(p => ({ x: p.km, y: p.ciLow / p.km }));
  const paceMax = predictions.map(p => ({ x: p.km, y: p.ciHigh / p.km }));

  new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Prediction Range (Upper)",
          data: paceMax,
          backgroundColor: "rgba(0,0,255,0.1)",
          borderColor: "transparent",
          pointRadius: 0,
          fill: "-1"
        },
        {
          label: "Prediction Range (Lower)",
          data: paceMin,
          backgroundColor: "rgba(0,0,255,0.1)",
          borderColor: "transparent",
          pointRadius: 0,
          fill: "+1"
        },
        {
          label: "Predicted Pace",
          data: paceMain,
          borderColor: "blue",
          backgroundColor: "blue",
          pointRadius: 5,
          tension: 0.2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: "linear",
          min: 0,
          max: 43,
          title: { display: true, text: "Distance (km)" }
        },
        y: {
          title: { display: true, text: "Pace (min/km)" }
        }
      }
    }
  });
}
