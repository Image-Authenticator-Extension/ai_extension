// Add CSS Styles
const style = document.createElement("style");
style.textContent = `
.ai-label-overlay {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 8px;
    color: white;
    font-family: 'Arial', sans-serif;
    font-weight: bold;
    font-size: 14px;
    border-radius: 8px;
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.ai-label-overlay .loading-indicator {
    font-size: 12px;
    color: #fff;
    margin-top: 5px;
}

.ai-label-overlay button {
    background: none;
    border: none;
    cursor: pointer;
    margin-top: 6px;
    font-size: 10px;
    color: #fff;
}

`;

document.head.appendChild(style);

// ---- Caching and State ----
const predictionCache = new Map();
const feedbackSent = new Set();
let extensionEnabled = true;
const inFlight = new Set();
let memoryLimit = 50;  // Limit cache size to 50 images

// Utility
function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// To Data URL
function toDataURL(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.onload = () => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(xhr.response);
        };
        xhr.onerror = reject;
        xhr.send();
    });
}

// Extract image URL
function extractImageURL(el) {
    if (!el) return null;
    if (el.tagName === 'IMG') return el.src || el.getAttribute('data-src');
    const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset');
    if (srcset) return srcset.split(',').pop().trim().split(' ')[0];
    const bg = getComputedStyle(el).backgroundImage;
    if (bg.startsWith('url(')) return bg.slice(5, -2);
    return null;
}

// Predict
async function predictImage(base64) {
    const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
    });
    return response.json();
}

// Overlay management
function updateOverlay(el, prediction, confidence) {
    let overlay = el.querySelector('.ai-label-overlay');
    const labelText = (prediction === "Real" && confidence <= 0.6)
        ? `Maybe-AI`
        : `🧠 ${prediction} (${(confidence * 100).toFixed(1)}%)`;

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'ai-label-overlay';
        el.appendChild(overlay);
    }

    // Display loading text until prediction result is available
    if (!predictionCache.has(el.dataset.imgUrl)) {
        overlay.innerHTML = `<div class="loading-indicator">Loading...</div>`;
    } else {
        overlay.innerHTML = ` 
            <div>${labelText}</div>
            <button class="feedback-btn" title="Feedback">${feedbackSent.has(el.dataset.imgUrl) ? '✔️' : '👍 / 👎'}</button>
        `;
    }

    // Applying a gradient background based on the prediction
    let gradientBackground = '';
    if (prediction === "AI") {
        gradientBackground = 'linear-gradient(145deg, rgba(177, 16, 16, 0.85), rgba(255, 100, 100, 0.85))';  // Red gradient for AI-generated
    } else if (prediction === "Maybe-AI") {
        gradientBackground = 'linear-gradient(145deg, rgba(255, 165, 0, 0.85), rgba(255, 220, 100, 0.85))';  // Orange gradient for Maybe-AI
    } else {
        gradientBackground = 'linear-gradient(145deg, rgba(22, 202, 22, 0.85), rgba(80, 255, 80, 0.85))';  // Green gradient for Real
    }

    overlay.style.background = gradientBackground;

    overlay.querySelector('.feedback-btn').onclick = () => {
        if (feedbackSent.has(el.dataset.imgUrl)) return;
        sendFeedback(el.dataset.imgUrl, prediction, confidence, 'feedback');
        feedbackSent.add(el.dataset.imgUrl);
        overlay.querySelector('.feedback-btn').textContent = '✔️ Sent';
    };
}



function removeOverlay(el) {
    el.querySelector('.ai-label-overlay')?.remove();
}

// Process Image
async function processImage(el, imgUrl) {
    if (predictionCache.has(imgUrl) || inFlight.has(imgUrl)) return;

    inFlight.add(imgUrl);
    el.dataset.imgUrl = imgUrl;

    try {
        const base64 = await toDataURL(imgUrl);

        // Skip small images (icon, profile pic etc.)
        const img = new Image();
        img.src = imgUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        if (img.width < 100 || img.height < 100) {
            inFlight.delete(imgUrl);
            return;
        }

        const { prediction, confidence } = await predictImage(base64);

        const finalPred = (prediction === "Real" && confidence < 0.5) ? "AI" : prediction;
        predictionCache.set(imgUrl, { prediction: finalPred, confidence });

        // Cache limit: Remove older predictions if limit is reached
        if (predictionCache.size > memoryLimit) {
            predictionCache.delete(predictionCache.keys().next().value);
        }

        updateOverlay(el, finalPred, confidence);
    } catch (e) {
        console.error("Prediction error:", e);
    } finally {
        inFlight.delete(imgUrl);
    }
}

// Find Image
function findImageElement(el) {
    if (['SCRIPT', 'STYLE'].includes(el.tagName)) return null;
    const url = extractImageURL(el);
    if (url) return { el, url };
    for (const child of el.querySelectorAll('img, div')) {
        const childUrl = extractImageURL(child);
        if (childUrl) return { el: child, url: childUrl };
    }
    return null;
}

// Feedback (dummy version for now)
function sendFeedback(url, prediction, confidence, feedbackType) {
    console.log(`Feedback sent for ${url}: ${feedbackType}`);
    // POST to your server here if needed
}

// Hover Debounce
let hoverTimeout;
document.addEventListener('mouseover', (e) => {
    if (!extensionEnabled) return;
    const container = e.target.closest('div, article');
    if (!container) return;

    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(async () => {
        const found = findImageElement(container);
        if (found) {
            const { el, url } = found;
            if (predictionCache.has(url)) {
                const { prediction, confidence } = predictionCache.get(url);
                updateOverlay(container, prediction, confidence);
            } else {
                await processImage(container, url);
            }
        }
    }, 250);
}, true);

document.addEventListener('mouseout', (e) => {
    if (!extensionEnabled) return;
    clearTimeout(hoverTimeout);
    const container = e.target.closest('div, article');
    if (container) {
        removeOverlay(container);
    }
}, true);

// Ctrl+Shift+Y Toggle
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
        extensionEnabled = !extensionEnabled;
        console.log(`🧠 Extension ${extensionEnabled ? "enabled" : "disabled"}`);
        if (!extensionEnabled) {
            document.querySelectorAll('.ai-label-overlay').forEach(el => el.remove());
        }
    }
});

// Mutation Observer
const observer = new MutationObserver(mutations => {
    if (!extensionEnabled) return;
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            const imgs = node.querySelectorAll('img, div');
            imgs.forEach(img => {
                img.addEventListener('mouseover', (e) => {
                    const container = e.target.closest('div, article');
                    if (!container) return;

                    const found = findImageElement(container);
                    if (found) {
                        const { el, url } = found;
                        if (!predictionCache.has(url)) processImage(container, url);
                    }
                });
            });
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });
