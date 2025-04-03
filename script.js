function parseDuration(duration) {
  if (!duration || typeof duration !== "string") return null;
  const parts = duration.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return null;
}

function riegel(time, fromDist, toDist) {
  return time * Math.pow(toDist / fromDist, 1.06);
}

function dateWeight(date) {
  if (!date) return 1;
  const today = new Date();
  const daysAgo = (today - new Date(date)) / (1000 * 60 * 60 * 24);
  return 1 / (1 + daysAgo / 365);
}

function weightedAverage(predictions) {
  let total = 0, totalWeight = 0;
  predictions.forEach(p => {
    total += p.value * p.weight;
    totalWeight += p.weight;
  });
  return totalWeight > 0 ? total / totalWeight : null;
}

function calculatePredictions() {
  const distances = [1.609, 5, 10, 21.095, 42.195];
  const distanceNames = ["Mile (1.609 km)", "5K", "10K", "Half Marathon", "Marathon"];
  let userTimes = {};

  document.querySelectorAll(".distance-group").forEach(group => {
    const distAttr = group.getAttribute("data-distance");
    const inputs = group.querySelectorAll("input");
    let timesWithDates = [];

    if (distAttr === "custom") {
      for (let i = 0; i < inputs.length; i += 3) {
        const dist = parseFloat(inputs[i].value);
        const time = parseDuration(inputs[i + 1].value.trim());
        const date = inputs[i + 2].value || null;
        if (dist && time) {
          if (!userTimes[dist]) userTimes[dist] = [];
          userTimes[dist].push({ time, date });
        }
      }
    } else {
      const dist = parseFloat(distAttr);
      for (let i = 0; i < inputs.length; i += 2) {
        const time = parseDuration(inputs[i].value.trim());
        const date = inputs[i + 1].value || null;
        if (time) {
          if (!userTimes[dist]) userTimes[dist] = [];
          userTimes[dist].push({ time, date });
        }
      }
    }
  });

  let predictions = {};
  distances.forEach((targetDist, i) => {
    let allPredictions = [];
    for (let fromDist in userTimes) {
      const from = parseFloat(fromDist);
      if (from !== targetDist) {
        userTimes[fromDist].forEach(entry => {
          const pred = riegel(entry.time, from, targetDist);
          const weight = dateWeight(entry.date);
          allPredictions.push({ value: pred, weight });
        });
      }
    }
    if (allPredictions.length > 0) {
      predictions[distanceNames[i]] = weightedAverage(allPredictions);
    }
  });

  if (Object.keys(predictions).length === 0) {
    alert("Please enter at least one valid time.");
  } else {
    displayResults(predictions, userTimes);
  }
}

function displayResults(predictions, userTimes) {
  const resultsList = document.getElementById("results");
  resultsList.innerHTML = "";

  const distancesMap = {
    "Mile (1.609 km)": 1.609,
    "5K": 5,
    "10K": 10,
    "Half Marathon": 21.095,
    "Marathon": 42.195,
  };

  for (let label in predictions) {
    const timeMin = predictions[label];
    const dist = distancesMap[label];
    const pace = timeMin / dist;
    const totalSec = Math.round(timeMin * 60);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const formatted = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    const paceFormatted = `${paceMin}:${paceSec.toString().padStart(2, "0")} min/km`;

    let confidence = "—";
    const realTimes = userTimes[dist] || [];
    if (realTimes.length > 0) {
      const avgError = realTimes.reduce((sum, r) => sum + Math.abs(r.time - timeMin), 0) / realTimes.length;
      const relativeError = avgError / timeMin;
      const dataFactor = Math.min(realTimes.length, 6);
      const penaltyFactor = 3 + (5 - dataFactor) * 0.5;
      const reliability = Math.max(0, 100 * Math.exp(-relativeError * penaltyFactor));
      confidence = `${Math.round(reliability)}%`;
    }

    resultsList.innerHTML += `
      <li>
        <strong>${label}:</strong> ${formatted}<br>
        Pace: <em>${paceFormatted}</em><br>
        Confidence: <strong>${confidence}</strong>
      </li>`;
  }
}

// 📌 Fill sample data
function generateSampleData() {
  const today = new Date();
  function randomTime() {
    return `${Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, "0")}:${Math.floor(Math.random() * 60).toString().padStart(2, "0")}`;
  }
  function randomDate() {
    const offset = Math.floor(Math.random() * 300);
    const date = new Date(today - offset * 24 * 60 * 60 * 1000);
    return date.toISOString().split("T")[0];
  }

  document.querySelectorAll(".distance-group").forEach(group => {
    const inputs = group.querySelectorAll("input");
    const isCustom = group.getAttribute("data-distance") === "custom";
    let filled = 0;
    for (let i = 0; i < inputs.length; i += isCustom ? 3 : 2) {
      if (filled >= 2) break;
      if (isCustom) inputs[i].value = (Math.random() * 40 + 2).toFixed(2);
      inputs[i + (isCustom ? 1 : 0)].value = randomTime();
      inputs[i + (isCustom ? 2 : 1)].value = randomDate();
      filled++;
    }
  });
}
