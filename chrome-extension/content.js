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
}
`;
document.head.appendChild(style);

const predictionCache = new Map();

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
    removeOverlay(el);

    const label = document.createElement('div');
    label.className = 'ai-label-overlay';

    const percent = (confidence * 100).toFixed(1);
    const lowConfidence = prediction === "Real" && confidence >= 0.5 && confidence <= 0.6;
    label.textContent = lowConfidence ? "Maybe-AI" : `🧠 ${prediction} (${percent}%)`;

    label.style.backgroundColor =
        prediction === "AI-generated"
            ? 'rgba(255, 0, 0, 0.8)'
            : (lowConfidence ? 'rgba(255, 165, 0, 0.8)' : 'rgba(0, 128, 0, 0.8)');

    el.style.position = 'relative';
    el.insertAdjacentElement('afterbegin', label);
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

function processImage(el, imgUrl) {
    if (!imgUrl) return;

    const container = el.closest('article, div[class*="post"], div[class*="container"], div') || el.parentElement;

    if (predictionCache.has(imgUrl)) {
        const { prediction, confidence } = predictionCache.get(imgUrl);
        showOverlay(container, prediction, confidence);
        return;
    }

    toDataURL(imgUrl, async (base64Data) => {
        try {
            const data = await fetchPrediction(base64Data);

            let finalPrediction = data.prediction === "Real" ? "AI-generated" : "Real";
            if (data.confidence < 0.5) finalPrediction = "AI-generated";

            predictionCache.set(imgUrl, { prediction: finalPrediction, confidence: data.confidence });

            console.log(`🧠 [PREDICTED] ${imgUrl}`);
            console.log(` → Prediction: ${finalPrediction}`);
            console.log(` → Confidence: ${(data.confidence * 100).toFixed(2)}%`);

            showOverlay(container, finalPrediction, data.confidence);
        } catch (err) {
            console.error("❌ Prediction failed:", err);
        }
    });
}

// Hover listeners
document.addEventListener('mouseenter', (e) => {
    const container = e.target.closest('div');
    if (container) {
        const result = findImageInNested(container);
        if (result) {
            processImage(result.el, result.imgUrl);
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
