function weightedRiegel(times, fromDist, toDist) {
    let weights = [1, 0.9, 0.8];
    let totalWeightedTime = 0;
    let totalWeight = 0;

    times.forEach((time, idx) => {
        if(time) {
            totalWeightedTime += weights[idx] * time * Math.pow((toDist / fromDist), 1.06);
            totalWeight += weights[idx];
        }
    });

    return (totalWeightedTime / totalWeight).toFixed(2);
}

function calculatePredictions() {
    const distances = [1.609, 5, 10, 21.095, 42.195];
    const distanceNames = ["Mile (1.609 km)", "5K", "10K", "Half Marathon", "Marathon"];
    let userTimes = {};

    document.querySelectorAll('.distance-group').forEach(group => {
        let dist = group.getAttribute('data-distance');
        let inputs = group.querySelectorAll('input');
        userTimes[dist] = Array.from(inputs).map(input => parseFloat(input.value) || null).filter(Boolean);
    });

    let predictions = {};

    distances.forEach((targetDist, idx) => {
        let predictedTimes = [];
        
        for(let fromDist in userTimes) {
            if(userTimes[fromDist].length > 0) {
                predictedTimes.push(parseFloat(weightedRiegel(userTimes[fromDist], fromDist, targetDist)));
            }
        }

        if(predictedTimes.length > 0) {
            let bestPrediction = Math.min(...predictedTimes);
            predictions[distanceNames[idx]] = bestPrediction;
        }
    });

    displayResults(predictions);
}

function displayResults(predictions) {
    let resultsList = document.getElementById('results');
    resultsList.innerHTML = "";

    for(let race in predictions) {
        let li = document.createElement('li');
        li.textContent = `${race}: ${predictions[race]} min`;
        resultsList.appendChild(li);
    }
}
