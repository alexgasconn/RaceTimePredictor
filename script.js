function parseDuration(duration) {
    const parts = duration.split(":").map(Number);
    if(parts.length === 3) { // hh:mm:ss
        return parts[0]*60 + parts[1] + parts[2]/60;
    } else if(parts.length === 2) { // mm:ss
        return parts[0] + parts[1]/60;
    } else {
        return null;
    }
}

function dateWeightedRiegel(timesWithDates, fromDist, toDist) {
    const today = new Date();
    let totalWeightedTime = 0;
    let totalWeight = 0;

    timesWithDates.forEach(({time, date}) => {
        let weight = 1; 
        if (date) {
            const daysAgo = (today - new Date(date)) / (1000*60*60*24);
            weight = 1 / (1 + daysAgo/365); 
        }
        totalWeightedTime += weight * time * Math.pow((toDist/fromDist), 1.06);
        totalWeight += weight;
    });

    return totalWeightedTime / totalWeight;
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
            const date = dateStr ? dateStr : null;
            if(time){
                timesWithDates.push({time, date});
            }
        }
        if(timesWithDates.length > 0)
            userTimes[dist] = timesWithDates;
    });

    let predictions = {};

    distances.forEach((targetDist, idx) => {
        let predictedTimes = [];
        
        for(let fromDist in userTimes) {
            const prediction = dateWeightedRiegel(userTimes[fromDist], fromDist, targetDist);
            if (!isNaN(prediction)) {
                predictedTimes.push(prediction);
            }
        }

        if(predictedTimes.length > 0) {
            predictions[distanceNames[idx]] = Math.min(...predictedTimes);
        }
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
