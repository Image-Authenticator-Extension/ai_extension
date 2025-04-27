// Add CSS Styles
const style = document.createElement("style");
style.textContent = `
.ai-label-overlay {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 4px 8px;
    font-family: Arial, sans-serif;
    font-weight: bold;
    font-size: 12px;
    color: white;
    border-radius: 4px;
    z-index: 9999;
    pointer-events: none;
    btn.style.background = 'none';
btn.style.border = 'none';
btn.style.cursor = 'pointer';

}
`;
document.head.appendChild(style);

const predictionCache = new Map();
const inFlightPredictions = new Set();

function toDataURL(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
        const reader = new FileReader();
        reader.onloadend = () => callback(reader.result);
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
}

function extractImageURL(el) {
    if (el.tagName === 'IMG') {
        return el.src || el.getAttribute('data-src');
    }

    const srcset = el.getAttribute?.('srcset') || el.getAttribute?.('data-srcset');
    if (srcset) {
        const parts = srcset.split(',').map(s => s.trim());
        return parts[parts.length - 1].split(' ')[0];
    }

    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg.includes('url')) {
        return bg.slice(5, -2); // remove url("...") wrapper
    }

    return null;
}

function removeOverlay(el) {
    el.querySelector('.ai-label-overlay')?.remove();
}

function showOverlay(el, prediction, confidence) {
    removeOverlay(el); // avoid duplicates

    const label = document.createElement('div');
    label.className = 'ai-label-overlay';

    const confPercent = (confidence && !isNaN(confidence)) 
        ? (confidence * 100).toFixed(1) 
        : "N/A";
    
    const lowConfReal = prediction === "Real" && confidence >= 0.5 && confidence <= 0.6;
    const labelText = lowConfReal ? `Maybe-AI` : `🧠 ${prediction} (${confPercent}%)`;

    label.innerHTML = `
        <div style="margin-bottom: 4px;">${labelText}</div>
        <button class="feedback-btn" data-type="correct" title="Prediction Correct">👍</button>
        <button class="feedback-btn" data-type="incorrect" title="Prediction Wrong">👎</button>
    `;

    Object.assign(label.style, {
        position: 'absolute',
        top: '8px',
        left: '8px',
        padding: '6px',
        backgroundColor: prediction === "AI-generated"
            ? 'rgba(255, 0, 0, 0.85)'
            : (lowConfReal ? 'rgba(255, 165, 0, 0.85)' : 'rgba(0, 128, 0, 0.85)'),
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        borderRadius: '4px',
        zIndex: 9999,
        pointerEvents: 'auto',
        fontFamily: 'Arial, sans-serif'
    });

    el.style.position = 'relative';
    el.appendChild(label);

    label.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.style.margin = '2px';
        btn.style.fontSize = '10px';
        btn.addEventListener('click', () => {
            const feedback = btn.dataset.type;
            const imageUrl = extractImageURL(el);
            sendFeedback(imageUrl, prediction, confidence, feedback);
            btn.textContent = '✔️ Sent';
            btn.disabled = true;
        });
    });
}


async function fetchPrediction(base64Data) {
    const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data }),
    });
    return response.json();
}

function findImageInNested(el) {
    if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName)) return null;

    const direct = extractImageURL(el);
    if (direct) return { el, imgUrl: direct };

    for (const child of el.querySelectorAll('*')) {
        const nested = extractImageURL(child);
        if (nested) return { el: child, imgUrl: nested };
    }

    return null;
}

function isLogoImage(imgUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = imgUrl;
        img.onload = () => {
            const width = img.width;
            const height = img.height;
            if (width < 50 || height < 50) {
                console.log("Logo detected, skipping prediction.");
                resolve(true);
            } else {
                resolve(false);
            }
        };
        img.onerror = () => resolve(false); // in case image fails to load
    });
}

async function processImage(el, imgUrl) {
    if (!imgUrl || predictionCache.has(imgUrl) || inFlightPredictions.has(imgUrl)) return;
    // Skip images that are logos
    const isLogo = await isLogoImage(imgUrl);
    if (isLogo) return;
    const container = el.closest('article, div[class*="post"], div[class*="container"], div') || el.parentElement;

    inFlightPredictions.add(imgUrl);

    toDataURL(imgUrl, async (base64Data) => {
        try {
            const data = await fetchPrediction(base64Data);

            let rawConf = parseFloat(data.confidence);
            if (isNaN(rawConf)) {
                inFlightPredictions.delete(imgUrl);
                return; // ⛔️ Don't show overlay if confidence is invalid
            }

            let finalPrediction = data.prediction === "Real" ? "AI-generated" : "Real";
            if (rawConf < 0.5) finalPrediction = "AI-generated";

            predictionCache.set(imgUrl, { prediction: finalPrediction, confidence: rawConf });
            inFlightPredictions.delete(imgUrl);

            console.log(`🧠 [PREDICTED] ${imgUrl}`);
            console.log(` → Prediction: ${finalPrediction}`);
            console.log(` → Confidence: ${(rawConf * 100).toFixed(2)}%`);

            showOverlay(container, finalPrediction, rawConf);
        } catch (err) {
            console.error("❌ Prediction failed:", err);
            inFlightPredictions.delete(imgUrl);
        }
    });
}


// Hover listeners
document.addEventListener('mouseenter', (e) => {
    const container = e.target.closest('div');
    if (container) {
        const result = findImageInNested(container);
        if (result) {
            const { el, imgUrl } = result;

            // 👉 Check if already cached — show overlay directly
            if (predictionCache.has(imgUrl)) {
                const { prediction, confidence } = predictionCache.get(imgUrl);
                showOverlay(container, prediction, confidence);
            } else {
                // ❌ Not in cache — make prediction
                processImage(el, imgUrl);
            }
        }
    }
}, true);


document.addEventListener('mouseleave', (e) => {
    const container = e.target.closest('div');
    if (container) {
        removeOverlay(container);
    }
}, true);

// MutationObserver for dynamic content
const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                const imgs = node.querySelectorAll?.('img');
                imgs?.forEach(img => {
                    const url = extractImageURL(img);
                    if (url && !predictionCache.has(url)) {
                        img.addEventListener('mouseover', () => processImage(img, url));
                        img.addEventListener('mouseout', () => removeOverlay(img));
                    }
                });
            }
        });
    }
});

observer.observe(document.body, { childList: true, subtree: true });
