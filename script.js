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
  let total = 0,
    totalWeight = 0;
  predictions.forEach((p) => {
    total += p.value * p.weight;
    totalWeight += p.weight;
  });
  return totalWeight > 0 ? total / totalWeight : null;
}

function calculatePredictions() {
  const distances = [1.609, 5, 10, 21.095, 42.195];
  const distanceNames = ["Mile (1.609 km)", "5K", "10K", "Half Marathon", "Marathon"];
  let userTimes = {};

  document.querySelectorAll(".distance-group").forEach((group) => {
    const dist = parseFloat(group.getAttribute("data-distance"));
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

  let predictions = {};

  distances.forEach((targetDist, idx) => {
    let allPredictions = [];

    distances.forEach((fromDist) => {
      if (fromDist !== targetDist && userTimes[fromDist]) {
        userTimes[fromDist].forEach((entry) => {
          const predictedTime = riegel(entry.time, fromDist, targetDist);
          const weight = dateWeight(entry.date);
          allPredictions.push({ value: predictedTime, weight });
        });
      }
    });

    if (allPredictions.length > 0) {
      predictions[distanceNames[idx]] = weightedAverage(allPredictions);
    }
  });

  if (Object.keys(predictions).length === 0) {
    alert("No valid predictions could be made. Please enter at least one valid time.");
  } else {
    console.log("Predictions:", predictions);
    displayResults(predictions);
  }
}

function displayResults(predictions) {
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
    const userEntries = document.querySelector(`.distance-group[data-distance="${dist}"]`);
    if (userEntries) {
      const inputs = userEntries.querySelectorAll("input");
      let realTimes = [];

      for (let i = 0; i < inputs.length; i += 2) {
        const timeStr = inputs[i].value.trim();
        const time = parseDuration(timeStr);
        if (time) realTimes.push(time);
      }

      if (realTimes.length > 0) {
        const avgError =
          realTimes.reduce((sum, actual) => sum + Math.abs(actual - timeMin), 0) /
          realTimes.length;
        const relativeError = avgError / timeMin;
        const numEntries = realTimes.length;
        const dataFactor = Math.min(numEntries, 6); // máx. efecto con 5 o más datos
        const penaltyFactor = 3 + (5 - dataFactor) * 0.5; // entre 3.0 y 5.0
        
        const reliability = Math.max(0, 100 * Math.exp(-relativeError * penaltyFactor));
        confidence = `${Math.round(reliability)}%`;

      }
    }

    resultsList.innerHTML += `
      <li>
        <strong>${race}:</strong> ${timeFormatted}<br>
        Pace: <em>${paceFormatted}</em><br>
        Confidence: <strong>${confidence}</strong>
      </li>`;
  }
}
