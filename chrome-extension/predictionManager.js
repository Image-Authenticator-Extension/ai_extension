// Predict
async function predictImage(base64) {
    
    const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
    });
    return response.json();
}



// Process Image
async function processImage(el, imgUrl) {
    if (predictionCache.has(imgUrl) || inFlight.has(imgUrl)) return;

    inFlight.add(imgUrl);
    el.dataset.imgUrl = imgUrl;
    //el.style.position = 'relative';

    // Show loading overlay
    let overlay = el.querySelector('.ai-label-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'ai-label-overlay';
        el.appendChild(overlay);
    }
  

    try {
        const base64 = await toDataURL(imgUrl);

        // Skip small images (icon, profile pic etc.)
        const img = new Image();
        img.src = imgUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        if (img.width <=160 || img.height <= 160) {
            inFlight.delete(imgUrl);
            removeOverlay(el);
            return;
        }
        overlay.innerHTML = `<div class="loading-indicator">Loading...</div>`;
        overlay.style.background = 'linear-gradient(145deg, rgba(100, 100, 100, 0.85), rgba(150, 150, 150, 0.85))';

        const result = await predictImage(base64);
if (!result || !result.prediction || typeof result.confidence !== "number") {
    console.warn("Invalid prediction result:", result);
    removeOverlay(el);
    inFlight.delete(imgUrl);
    return;
}

let { prediction, confidence } = result;


        const finalPred =  prediction;
        predictionCache.set(imgUrl, { prediction: finalPred, confidence });

        // Cache limit: Remove older predictions if limit is reached
        if (predictionCache.size > memoryLimit) {
            predictionCache.delete(predictionCache.keys().next().value);
        }

        updateOverlay(el, finalPred, confidence);
    } catch (e) {
        console.error("Prediction error:", e);
        removeOverlay(el);
    } finally {
        inFlight.delete(imgUrl);
    }
}

