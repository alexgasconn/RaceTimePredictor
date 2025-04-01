# 🏃‍♂️ Riegel Race Predictor

**Riegel Race Predictor** is a web-based application that estimates your potential race times across various distances using your personal best performances and the Riegel formula. This tool assists runners in setting realistic goals and tracking progress based on their top race times.

## 📋 Features

- **User-Friendly Interface:** Input your top race times directly into the application without the need for file uploads.
- **Flexible Data Entry:** Enter up to three best times for each distance; if fewer are available, the application adjusts accordingly.
- **Weighted Predictions:** Utilizes a weighted average approach to provide more accurate race time predictions.
- **Real-Time Calculations:** Instantly computes predicted race times based on the provided data.

## 🛠️ How It Works

The application employs the Riegel formula to predict race times:

T₂ = T₁ × (D₂ / D₁)¹·⁰⁶


Where:
- `T₁` is the time achieved for distance `D₁`.
- `T₂` is the predicted time for distance `D₂`.
- `D₁` is the distance over which the initial time is achieved.
- `D₂` is the distance for which the time is to be predicted.

By inputting your best times for known distances, the application calculates predicted times for other distances, aiding in informed training and racing goals.

## 🚀 Getting Started

1. **Access the Application:**
   - Visit the [Riegel Race Predictor](https://alexgasconn.github.io/Riegel-Predictor/) hosted on GitHub Pages.

2. **Input Your Race Times:**
   - For each distance category (Mile, 5K, 10K, Half Marathon), enter your best race times in minutes. You can input up to three times per distance; if you have fewer, leave the additional fields blank.

3. **Calculate Predictions:**
   - Click the "Predict Times" button to compute your estimated race times for various distances.

4. **View Results:**
   - The application will display your predicted race times, allowing you to plan your training and racing strategies effectively.

## 📂 Project Structure

The repository consists of the following files:

- **`index.html`**: The main HTML file containing the structure of the web application.
- **`style.css`**: The stylesheet for styling the application's interface.
- **`script.js`**: The JavaScript file containing the logic for data input, calculations, and result display.

## 🌐 Deployment

The application is deployed using GitHub Pages. Any changes pushed to the repository will automatically update the live application.

## 🤝 Contributing

Contributions to enhance the functionality or user experience of the Riegel Race Predictor are welcome. Feel free to fork the repository, make improvements, and submit a pull request.

## 📝 License

This project is licensed under the MIT License.

---

By utilizing the Riegel Race Predictor, you can gain insights into your running potential and set achievable goals based on your past performances. Happy running!
