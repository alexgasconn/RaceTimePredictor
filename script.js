function parseDuration(duration) {
    const parts = duration.trim().split(":").map(Number);
    if(parts.length === 3) // hh:mm:ss
        return parts[0]*60 + parts[1] + parts[2]/60;
    else if(parts.length === 2) // mm:ss
        return parts[0] + parts[1]/60;
    else
        return null;
}

function dateWeight(date) {
    if(!date) return 1;
    const today = new Date();
    const daysAgo = (today - new Date(date)) / (1000*60*60*24);
    return 1 / (1 + daysAgo/365); // más reciente más peso
}

function riegel(time, fromDist, toDist) {
    return time * Math.pow(toDist / fromDist, 1.06);
}

function weightedAverage(predictions) {
    let total = 0, weightSum = 0;
    predictions.forEach(p => {
        total += p.value * p.weight;
        weightSum += p.weight;
    });
    return total / weightSum;
}

function calculatePredictions() {
    const distances = [1.609, 5, 10, 21.095, 42.195];
    const distanceNames = ["Mile (1.609 km)", "5K", "10K", "Half Marathon", "Marathon"];
    let userTimes = {};

    document.querySelectorAll('.distance-group').forEach(group => {
        const dist = parseFloat(group.getAttribute('data-distance'));
        const inputs = group.querySelectorAll('input');
        let timesWithDates = [];

        for(let i = 0; i < inputs.length; i += 2) {
            const timeStr = inputs[i].value.trim();
            const dateStr = inputs[i+1].value;
            const time = parseDuration(timeStr);
            if(time) timesWithDates.push({time, date: dateStr || null});
        }
        if(timesWithDates.length > 0) userTimes[dist] = timesWithDates;
    });

    let predictions = {};

    distances.forEach((targetDist, idx) => {
        let allPredictions = [];

        distances.forEach(fromDist => {
            if(fromDist !== targetDist && userTimes[fromDist]) {
                userTimes[fromDist].forEach(entry => {
                    const predictedTime = riegel(entry.time, fromDist, targetDist);
                    const weight = dateWeight(entry.date);
                    allPredictions.push({value: predictedTime, weight});
                });
            }
        });

        if(allPredictions.length > 0)
            predictions[distanceNames[idx]] = weightedAverage(allPredictions);
    });

    displayResults(predictions);
}

function displayResults(predictions) {
    let resultsList = document.getElementById('results');
    resultsList.innerHTML = "";

    for(let race in predictions) {
        const totalSeconds = predictions[race] * 60;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.round(totalSeconds % 60);

        const formatted = hours > 0 ? 
            `${hours}h ${minutes}m ${seconds}s` : 
            `${minutes}m ${seconds}s`;

        resultsList.innerHTML += `<li>${race}: ${formatted}</li>`;
    }
}
