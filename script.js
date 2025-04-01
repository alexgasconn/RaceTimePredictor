function dateWeightedRiegel(timesWithDates, fromDist, toDist) {
    const today = new Date();
    let totalWeightedTime = 0;
    let totalWeight = 0;

    timesWithDates.forEach(({time, date}) => {
        if(time && date){
            const daysAgo = (today - new Date(date)) / (1000*60*60*24);
            const weight = 1 / (1 + daysAgo/365); // Más reciente = más peso
            totalWeightedTime += weight * time * Math.pow((toDist/fromDist), 1.06);
            totalWeight += weight;
        }
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
            const time = parseFloat(inputs[i].value);
            const date = inputs[i+1].value;
            if(time && date){
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
        let li = document.createElement('li');
        li.textContent = `${race}: ${predictions[race]} min`;
        resultsList.appendChild(li);
    }
}
