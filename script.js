function displayResults(predictions) {
    const resultsList = document.getElementById('results');
    resultsList.innerHTML = "";

    const distancesMap = {
        "Mile (1.609 km)": 1.609,
        "5K": 5,
        "10K": 10,
        "Half Marathon": 21.095,
        "Marathon": 42.195
    };

    for (let race in predictions) {
        const timeMin = predictions[race];
        const dist = distancesMap[race];
        const pace = timeMin / dist;

        // Convert predicted time to hh:mm:ss
        const totalSeconds = timeMin * 60;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.round(totalSeconds % 60);
        const timeFormatted = hours > 0 ?
            `${hours}h ${minutes}m ${seconds}s` :
            `${minutes}m ${seconds}s`;

        // Pace format mm:ss/km
        const paceMin = Math.floor(pace);
        const paceSec = Math.round((pace - paceMin) * 60);
        const paceFormatted = `${paceMin}:${paceSec.toString().padStart(2, '0')} min/km`;

        // Fiabilidad (si hay datos reales de esa distancia)
        let confidence = "—";
        const userEntries = document.querySelector(`.distance-group[data-distance="${dist}"]`);
        if (userEntries) {
            const inputs = userEntries.querySelectorAll('input');
            let realTimes = [];

            for (let i = 0; i < inputs.length; i += 2) {
                const timeStr = inputs[i].value.trim();
                const time = parseDuration(timeStr);
                if (time) realTimes.push(time);
            }

            if (realTimes.length > 0) {
                const avgError = realTimes.reduce((sum, actual) => sum + Math.abs(actual - timeMin), 0) / realTimes.length;
                const relativeError = avgError / timeMin;
                const reliability = Math.max(0, 100 - relativeError * 100); // in %
                confidence = `${Math.round(reliability)}%`;
            }
        }

        resultsList.innerHTML += `
            <li>
                <strong>${race}:</strong> ${timeFormatted}  
                <br> Pace: <em>${paceFormatted}</em>
                <br> Confidence: <strong>${confidence}</strong>
            </li>
        `;
    }
}
