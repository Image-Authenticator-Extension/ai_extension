//Resize the image
function resizeAndConvertToBase64(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
        const reader = new FileReader();
        reader.onloadend = function () {
            const img = new Image();
            img.onload = function () {
                const maxDimension = 512; // ✅ Max width/height set karo

                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height *= maxDimension / width;
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width *= maxDimension / height;
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8); // ✅ Quality compress bhi kar rahe 80%
                callback(resizedBase64);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
}


const loggedImages = new Set();

function extractImageURL(el) {
    if (el.tagName === 'IMG' && el.src) return el.src;

    const srcset = el.getAttribute?.('srcset');
    if (srcset) {
        const parts = srcset.split(',');
        const last = parts[parts.length - 1].trim();
        return last.split(' ')[0];
    }

    const styleBg = window.getComputedStyle(el).backgroundImage;
    if (styleBg && styleBg !== 'none' && styleBg.includes('url')) {
        return styleBg.slice(5, -2);
    }

    return null;
}

function showOverlay(el, prediction, confidence) {
    removeOverlay(el); // Ensure no duplicate

    const label = document.createElement('div');
    label.className = 'ai-label-overlay';
    label.textContent = `🧠 ${prediction} (${(confidence * 100).toFixed(1)}%)`;

    Object.assign(label.style, {
        position: 'absolute',
        top: '8px',
        left: '8px',
        padding: '4px 8px',
        backgroundColor: prediction === "AI-generated" ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 128, 0, 0.8)',
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        borderRadius: '4px',
        zIndex: 9999,
        pointerEvents: 'none',
        fontFamily: 'Arial, sans-serif'
    });

    el.style.position = 'relative';
    el.appendChild(label);
}

function removeOverlay(el) {
    const existing = el.querySelector('.ai-label-overlay');
    if (existing) existing.remove();
}

function findImageInNested(el) {
    if (!el || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return null;

    let imgUrl = extractImageURL(el);
    if (imgUrl) return { el, imgUrl };

    for (const child of el.querySelectorAll('*')) {
        const childUrl = extractImageURL(child);
        if (childUrl) return { el: child, imgUrl: childUrl };
    }

    return null;
}

function processImage(targetEl, imgUrl) {
    if (!imgUrl) return;

    const container = targetEl.closest('article, div[class*="post"], div[class*="container"], div') || targetEl.parentElement;

    if (loggedImages.has(imgUrl)) {
        const existing = container.dataset.prediction;
        const conf = parseFloat(container.dataset.confidence);
        if (existing) {
            console.log(`🟡 [HOVER AGAIN] Image: ${imgUrl}`);
            console.log(`   → Prediction: ${existing}`);
            console.log(`   → Confidence: ${(conf * 100).toFixed(2)}%`);
            showOverlay(container, existing, conf);
        }
        return;
    }

    toDataURL(imgUrl, function (base64Data) {
        fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Data })
        })
        .then(response => response.json())
        .then(data => {
            let finalPrediction = data.prediction === "Real" ? "AI-generated" : "Real";
if (data.confidence < 0.5) {
    finalPrediction = "AI-generated"; // Or choose a fallback
}


            container.dataset.prediction = finalPrediction;
            container.dataset.confidence = data.confidence;
            loggedImages.add(imgUrl);

            console.log(`🧠 [PREDICTED] Image: ${imgUrl}`);
            console.log(`   → Prediction: ${finalPrediction}`);
            console.log(`   → Confidence: ${(data.confidence * 100).toFixed(2)}%`);

            showOverlay(container, finalPrediction, data.confidence);
        })
        .catch(error => {
            console.error("❌ Prediction error:", error);
        });
    });
}

// Hover detection
// Hover detection
document.addEventListener('mouseenter', function (e) {
    const container = e.target.closest('div');
    if (container) {
        const result = findImageInNested(container);
        if (result) {
            processImage(result.el, result.imgUrl);
        }
    }
}, true); // Use capture phase

// Remove overlay
document.addEventListener('mouseleave', function (e) {
    const container = e.target.closest('div');
    if (container) {
        removeOverlay(container);
    }
}, true);


// MutationObserver to support dynamic image posts
const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                const imgs = node.querySelectorAll?.('img');
                imgs?.forEach(img => {
                    const url = extractImageURL(img);
                    if (url && !loggedImages.has(url)) {
                        img.addEventListener('mouseover', () => processImage(img.parentElement, url));
                        img.addEventListener('mouseout', () => removeOverlay(img.parentElement));
                    }
                });
            }
        });
    }
});

observer.observe(document.body, { childList: true, subtree: true });
