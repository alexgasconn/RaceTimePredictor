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

function calculatePredictions() {
  const userTimes = {};
  document.querySelectorAll(".distance-group").forEach((group) => {
    const distAttr = group.getAttribute("data-distance");
    const inputs = group.querySelectorAll("input");
    const dist = parseFloat(distAttr);
    if (distAttr === "custom") {
      const customDist = parseFloat(inputs[0].value);
      const time = parseDuration(inputs[1].value);
      const date = inputs[2].value;
      if (customDist && time) {
        if (!userTimes[customDist]) userTimes[customDist] = [];
        userTimes[customDist].push({ time, date });
      }
    } else {
      const time = parseDuration(inputs[0].value);
      const date = inputs[1].value;
      if (time) {
        if (!userTimes[dist]) userTimes[dist] = [];
        userTimes[dist].push({ time, date });
      }
    }
  });

  const predictions = {};
  const distances = [1.609, 5, 10, 21.095, 42.195];
  const names = ["Mile (1.609 km)", "5K", "10K", "Half Marathon", "Marathon"];

  distances.forEach((targetDist, idx) => {
    let all = [];
    for (let fromDist in userTimes) {
      fromDist = parseFloat(fromDist);
      if (fromDist === targetDist) continue;
      userTimes[fromDist].forEach(({ time, date }) => {
        const predicted = riegel(time, fromDist, targetDist);
        const weight = date ? 1 / (1 + ((new Date() - new Date(date)) / (1000 * 60 * 60 * 24 * 365))) : 1;
        all.push({ value: predicted, weight });
      });
    }
    if (all.length > 0) {
      const total = all.reduce((sum, p) => sum + p.value * p.weight, 0);
      const totalWeight = all.reduce((sum, p) => sum + p.weight, 0);
      predictions[names[idx]] = total / totalWeight;
    }
  });

  const list = document.getElementById("results");
  list.innerHTML = "";
  for (let name in predictions) {
    const min = predictions[name];
    const sec = Math.round(min * 60);
    const pace = min / distances[names.indexOf(name)];
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);

    list.innerHTML += `
      <li>
        <strong>${name}</strong>: ${Math.floor(sec / 60)}m ${sec % 60}s<br>
        Pace: ${paceMin}:${paceSec.toString().padStart(2, "0")} min/km
      </li>
    `;
  }
}
