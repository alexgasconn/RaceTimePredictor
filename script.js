function parseDuration(duration) {
  if (!duration || typeof duration !== "string") return null;
  const parts = duration.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  } else if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  } else {
    return null;
  }
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

  // Get all fixed distances
  document.querySelectorAll(".distance-group").forEach((group) => {
    const distAttr = group.getAttribute("data-distance");
    if (distAttr === "custom") return;

    const dist = parseFloat(distAttr);
    const inputs = group.querySelectorAll("input");
    let timesWithDates = [];

    for (let i = 0; i < inputs.length; i += 2) {
      const timeStr = inputs[i].value.trim();
      const dateStr = inputs[i + 1].value;
      const time = parseDuration(timeStr);
      const date = dateStr || null;
      if (time) {
        timesWithDates.push({ time, date });
      }
    }

    if (timesWithDates.length > 0) {
      userTimes[dist] = timesWithDates;
    }
  });

  // Handle custom distances
  const customGroup = document.querySelector('.distance-group[data-distance="custom"]');
  if (customGroup) {
    const inputs = customGroup.querySelectorAll("input");
    for (let i = 0; i < inputs.length; i += 3) {
      const dist = parseFloat(inputs[i].value);
      const timeStr = inputs[i + 1].value.trim();
      const dateStr = inputs[i + 2].value;
      const time = parseDuration(timeStr);
      const date = dateStr || null;

      if (dist && time) {
        if (!userTimes[dist]) userTimes[dist] = [];
        userTimes[dist].push({ time, date });
      }
    }
  }

  let predictions = {};

  distances.forEach((targetDist, idx) => {
    let allPredictions = [];

    for (let fromDist in userTimes) {
      const from = parseFloat(fromDist);
      if (from !== targetDist) {
        userTimes[fromDist].forEach((entry) => {
          const predictedTime = riegel(entry.time, from, targetDist);
          const weight = dateWeight(entry.date);
          allPredictions.push({ value: predictedTime, weight });
        });
      }
    }

    if (allPredictions.length > 0) {
      predictions[distanceNames[idx]] = weightedAverage(allPredictions);
    }
  });

  if (Object.keys(predictions).length === 0) {
    alert("No valid predictions could be made. Please enter at least one valid time.");
  } else {
    console.log("Predictions:", predictions);
    displayResults(predictions, userTimes);
  }
}

function displayResults(predictions, userTimes = {}) {
  const resultsList = document.getElementById("results");
  resultsList.innerHTML = "";

  const distancesMap = {
    "Mile (1.609 km)": 1.609,
    "5K": 5,
    "10K": 10,
    "Half Marathon": 21.095,
    "Marathon": 42.195,
  };

  for (let race in predictions) {
    const timeMin = predictions[race];
    const dist = distancesMap[race];
    const pace = timeMin / dist;

    const totalSeconds = timeMin * 60;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    const timeFormatted =
      hours > 0
        ? `${hours}h ${minutes}m ${seconds}s`
        : `${minutes}m ${seconds}s`;

    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    const paceFormatted = `${paceMin}:${paceSec.toString().padStart(2, "0")} min/km`;

    let confidence = "—";
    const realTimes = userTimes[dist] || [];

    if (realTimes.length > 0) {
      const avgError =
        realTimes.reduce((sum, actual) => sum + Math.abs(actual.time - timeMin), 0) /
        realTimes.length;
      const relativeError = avgError / timeMin;
      const numEntries = realTimes.length;
      const dataFactor = Math.min(numEntries, 6);
      const penaltyFactor = 3 + (5 - dataFactor) * 0.5;
      const reliability = Math.max(0, 100 * Math.exp(-relativeError * penaltyFactor));
      confidence = `${Math.round(reliability)}%`;
    }

    resultsList.innerHTML += `
      <li>
        <strong>${race}:</strong> ${timeFormatted}<br>
        Pace: <em>${paceFormatted}</em><br>
        Confidence: <strong>${confidence}</strong>
      </li>`;
  }
}

// 🔶 ML Prediction Button Logic
function predictWithML() {
  const distancesMap = {
    "Mile (1.609 km)": 1.609,
    "5K": 5,
    "10K": 10,
    "Half Marathon": 21.095,
    "Marathon": 42.195,
  };

  const today = new Date();
  let dataset = [];

  document.querySelectorAll(".distance-group").forEach(group => {
    const distAttr = group.getAttribute("data-distance");
    if (distAttr === "custom") return;

    const dist = parseFloat(distAttr);
    const inputs = group.querySelectorAll("input");

    for (let i = 0; i < inputs.length; i += 2) {
      const time = parseDuration(inputs[i].value.trim());
      const dateStr = inputs[i + 1].value;
      const date = dateStr ? new Date(dateStr) : null;
      if (time && date) {
        const daysAgo = (today - date) / (1000 * 60 * 60 * 24);
        dataset.push({ distance: dist, time, daysAgo });
      }
    }
  });

  if (dataset.length < 3) {
    alert("Need at least 3 valid entries with time + date for ML prediction.");
    return;
  }

  const X = dataset.map(d => [d.distance, d.daysAgo]);
  const y = dataset.map(d => d.time);

  // Solve linear regression: theta = (X^T X)^-1 X^T y
  const XT = math.transpose(X);
  const XTX = math.multiply(XT, X);
  const XTy = math.multiply(XT, y);
  const theta = math.lusolve(XTX, XTy).flat(); // [coef_dist, coef_days, intercept]

  // Predict each official distance
  const predictions = {};
  Object.entries(distancesMap).forEach(([label, dist]) => {
    const predicted = dist * theta[0] + 0 * theta[1] + theta[2];
    predictions[label] = predicted;
  });

  // Add results to HTML
  const resultsList = document.getElementById("results");
  const items = resultsList.querySelectorAll("li");

    const items = resultsList.querySelectorAll("li");
  Object.entries(predictions).forEach(([raceLabel, mlTime]) => {
    const sec = mlTime * 60;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.round(sec % 60);
    const formatted = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;

    // Buscar el <li> correspondiente a esta distancia
    items.forEach(li => {
      const strong = li.querySelector("strong");
      if (strong && strong.innerText === raceLabel && !li.innerHTML.includes("ML Prediction")) {
        li.innerHTML += `<br><span style="color: #ff7f00;">ML Prediction: ${formatted}</span>`;
      }
    });
  });

