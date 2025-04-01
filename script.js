function parseDuration(duration) {
    const parts = duration.split(":").map(Number);
    if(parts.length === 3) {
        return parts[0] * 60 + parts[1] + parts[2]/60;
    } else if(parts.length === 2) {
        return parts[0] + parts[1]/60;
    } else if(parts.length === 1) {
        return parts[0]/60;
    }
    return null;
}

function dateWeightedRiegel(timesWithDates, fromDist, toDist) {
    const today = new Date();
    let totalWeightedTime = 0;
    let totalWeight = 0;

    timesWithDates.forEach(({time, date}) => {
        let weight = 1; // Default weight
        if (date) {
            const daysAgo = (today - new Date(date)) / (1000*60*60*24);
            weight = 1 / (1 + daysAgo/365); 
        }
        totalWeightedTime += weight * time * Math.pow((toDist/fromDist), 1.06);
        totalWeight += weight;
    });

    return (totalWeightedTime / totalWeight).toFixed(2);
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
            const timeStr = inputs[i].value;
            const date = inputs[i+1].value || null; // Date is optional
            const time = parseDuration(timeStr);
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
            if(userTimes[fromDist].length > 0) {
                predictedTimes.push(parseFloat(dateWeightedRiegel(userTimes[fromDist], fromDist, targetDist)));
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
        let minutes = Math.floor(predictions[race]);
        let seconds = Math.round((predictions[race] - minutes) * 60);
        resultsList.innerHTML += `<li>${race}: ${minutes} min ${seconds} sec</li>`;
    }
}
