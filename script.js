function parseDuration(str) {
  const parts = str.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0]*60 + parts[1] + parts[2]/60;
  if (parts.length === 2) return parts[0] + parts[1]/60;
  return null;
}

function riegel(time, fromDist, toDist) {
  return time * Math.pow(toDist / fromDist, 1.06);
}

function dateWeight(date) {
  if (!date) return 1;
  const daysAgo = (new Date() - new Date(date)) / (1000 * 60 * 60 * 24);
  return 1 / (1 + daysAgo / 365);
}

function weightedAverage(predictions) {
  let total = 0, weightSum = 0;
  predictions.forEach(p => {
    total += p.value * p.weight;
    weightSum += p.weight;
  });
  return total / weightSum;
}

function formatTime(mins) {
  const totalSeconds = mins * 60;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function calculatePredictions() {
  const distances = [1.609, 5, 10, 21.095, 42.195];
  const names = {
    1.609: "Mile (1.609 km)",
    5: "5K",
    10: "10K",
    21.095: "Half Marathon",
    42.195: "Marathon"
  };

  const userTimes = {};
  const results = {};

  distances.forEach(dist => {
    const group = document.querySelector(`.distance-group[data-distance="${dist}"]`);
    const inputs = group.querySelectorAll("input");
    const values = [];

    for (let i = 0; i < inputs.length; i += 2) {
      const time = parseDuration(inputs[i].value);
      const date = inputs[i+1].value;
      if (time) values.push({ time, date });
    }
    if (values.length > 0) userTimes[dist] = values;
  });

  distances.forEach(target => {
    let all = [];

    for (let from in userTimes) {
      if (parseFloat(from) !== target) {
        userTimes[from].forEach(entry => {
          const predicted = riegel(entry.time, parseFloat(from), target);
          const weight = dateWeight(entry.date);
          all.push({ value: predicted, weight });
        });
      }
    }

    if (all.length > 0) {
      const avg = weightedAverage(all);
      results[target] = avg;
    }
  });

  showResults(results, userTimes, names);
}

function showResults(results, userTimes, names) {
  const list = document.getElementById("results");
  list.innerHTML = "";

  for (let dist in results) {
    const time = results[dist];
    const pace = time / dist;
    const paceMin = Math.floor(pace);
    const paceSec = Math.round((pace - paceMin) * 60);
    const paceFormatted = `${paceMin}:${paceSec.toString().padStart(2, '0')} min/km`;

    const group = document.querySelector(`.distance-group[data-distance="${dist}"]`);
    const canvas = group.querySelector("canvas");
    const ctx = canvas.getContext("2d");

    const realData = userTimes[dist]?.map(e => e.time) || [];
    const lower = time * 0.95;
    const upper = time * 1.05;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: realData.map((_, i) => `#${i + 1}`),
        datasets: [
          {
            label: "User Time",
            data: realData,
            borderColor: "blue",
            tension: 0.2,
            fill: false
          },
          {
            label: "Predicted",
            data: new Array(realData.length).fill(time),
            borderColor: "green",
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: "±5% Range",
            data: new Array(realData.length).fill(upper),
            backgroundColor: "rgba(0,255,0,0.1)",
            fill: '+1',
            pointRadius: 0,
            borderWidth: 0
          },
          {
            label: "",
            data: new Array(realData.length).fill(lower),
            fill: '-1',
            backgroundColor: "rgba(0,255,0,0.1)",
            pointRadius: 0,
            borderWidth: 0
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: false }
        },
        responsive: true,
        scales: {
          y: { title: { display: true, text: "Minutes" } }
        }
      }
    });

    list.innerHTML += `
      <li>
        <strong>${names[dist]}:</strong> ${formatTime(time)}<br>
        Pace: <em>${paceFormatted}</em>
      </li>
    `;
  }
}
