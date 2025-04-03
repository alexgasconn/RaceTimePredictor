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
    if (distAttr === "custom") return;

    const dist = parseFloat(distAttr);
    const inputs = group.querySelectorAll("input");
    let timesWithDates = [];

    for (let i = 0; i < inputs.length; i += 2) {
      const time = parseDuration(inputs[i].value.trim());
      const date = inputs[i + 1].value || null;
      if (time) timesWithDates.push({ time, date });
    }

    if (timesWithDates.length > 0) userTimes[dist] = timesWithDates;
  });

  const customGroup = document.querySelector('.distance-group[data-distance="custom"]');
  if (customGroup) {
    const inputs = customGroup.querySelectorAll("input");
    for (let i = 0; i < inputs.length; i += 3) {
      const dist = parseFloat(inputs[i].value);
      const time = parseDuration(inputs[i + 1].value.trim());
      const date = inputs[i + 2].value || null;
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
        userTimes[fromDist].forEach(entry => {
          const predicted = riegel(entry.time, from, targetDist);
          const weight = dateWeight(entry.date);
          allPredictions.push({ value: predicted, weight });
        });
      }
    }

    if (allPredictions.length > 0)
      predictions[distanceNames[idx]] = weightedAverage(allPredictions);
  });

  displayResults(predictions, userTimes);
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

    const totalSec = timeMin * 60;
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = Math.round(totalSec % 60);
    const timeFormatted = hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;

    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    const paceFormatted = `${paceMin}:${paceSec.toString().padStart(2, "0")} min/km`;

    let confidence = "—";
    const realTimes = userTimes[dist] || [];
    if (realTimes.length > 0) {
      const avgError = realTimes.reduce((sum, t) => sum + Math.abs(t.time - timeMin), 0) / realTimes.length;
      const relativeError = avgError / timeMin;
      const penaltyFactor = 3 + (5 - Math.min(realTimes.length, 6)) * 0.5;
      confidence = `${Math.round(Math.max(0, 100 * Math.exp(-relativeError * penaltyFactor)))}%`;
    }

    resultsList.innerHTML += `
      <li>
        <strong>${race}:</strong> ${timeFormatted}<br>
        Pace: <em>${paceFormatted}</em><br>
        Confidence: <strong>${confidence}</strong>
      </li>`;
  }
}

function sampleData() {
  const sampleTimes = {
    "1.609": [6.5, 6.8],     // Mile in minutes
    "5": [22, 23],
    "10": [46, 47],
    "21.095": [98, 100],
    "42.195": [210, 215]
  };

  const today = new Date().toISOString().split("T")[0];

  document.querySelectorAll(".distance-group").forEach(group => {
    const dist = group.getAttribute("data-distance");
    const rows = group.querySelectorAll(".time-row");

    rows.forEach((row, i) => {
      const inputs = row.querySelectorAll("input");
      if (i < 2) {
        let minutes = sampleTimes[dist] ? sampleTimes[dist][i] : Math.random() * 150 + 20;
        const mins = Math.floor(minutes);
        const secs = Math.round((minutes - mins) * 60);
        inputs[0].value = `0:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        inputs[1].value = today;
      } else {
        inputs.forEach(input => input.value = "");
      }
    });
  });
}
