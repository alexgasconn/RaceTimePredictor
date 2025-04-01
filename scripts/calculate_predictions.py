import pandas as pd
import numpy as np

def weighted_riegel(df, target_distance):
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date', ascending=False).head(3)  # Top 3 recent races
    weights = np.linspace(1, 0.8, len(df))  # recent races have more weight
    
    weighted_times = []
    for weight, (_, row) in zip(weights, df.iterrows()):
        predicted = row['time_min'] * (target_distance / row['distance_km']) ** 1.06
        weighted_times.append(predicted * weight)
    
    return sum(weighted_times) / sum(weights)

data = pd.read_csv('../data/races.csv')

distances = {
    "Mile (1.609 km)": 1.609,
    "5K": 5,
    "10K": 10,
    "Half Marathon": 21.095,
    "Marathon": 42.195
}

predictions = {}
for name, dist in distances.items():
    predictions[name] = round(weighted_riegel(data, dist), 2)

print("Race Predictions (minutes):")
for race, time in predictions.items():
    print(f"{race}: {time} min")
