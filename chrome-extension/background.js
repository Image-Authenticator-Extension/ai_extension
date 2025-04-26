// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.imageBase64) {
//       console.log("📤 Sending image to Flask...");

//       fetch("http://127.0.0.1:5000/predict", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ image: request.imageBase64 })
//       })
//       .then(response => response.json())
//       .then(data => {
//           console.log("✅ Prediction received:", data);
//       })
//       .catch(error => {
//           console.error("❌ Error during prediction:", error);
//       });
//   }
// });
console.log("Welcome");
console.loh("to detect images");