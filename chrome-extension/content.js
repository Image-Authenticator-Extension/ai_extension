function toDataURL(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
        const reader = new FileReader();
        reader.onloadend = function () {
            callback(reader.result);
        };
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
}

const loggedImages = new Set();

function extractImageURL(img) {
    if (img.src) return img.src;
    const srcset = img.getAttribute('srcset');
    if (srcset) {
        const parts = srcset.split(',');
        const last = parts[parts.length - 1].trim();
        return last.split(' ')[0];
    }
    const styleBg = window.getComputedStyle(img).backgroundImage;
    if (styleBg && styleBg !== 'none') {
        return styleBg.slice(5, -2); // remove `url("...")`
    }
    return null;
}

function processImage(img) {
    const imgUrl = extractImageURL(img);
    if (!imgUrl || loggedImages.has(imgUrl)) return;

    loggedImages.add(imgUrl);
    console.log('🖼️ Logging Image URL:', imgUrl);

    toDataURL(imgUrl, function (base64Data) {
        fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Data })
        })
            .then(response => response.json())
            .then(data => {
                let finalPrediction = data.prediction;
                if (data.confidence < 0.5) {
                    finalPrediction = "AI-generated";
                }

                console.log("✅ Prediction:", finalPrediction, `(Confidence: ${data.confidence.toFixed(2)})`);
                showOverlay(img, finalPrediction, data.confidence);
            })
            .catch(error => {
                console.error("❌ Prediction error:", error);
            });
    });
}

function showOverlay(img, prediction, confidence) {
    const existingLabel = img.parentElement.querySelector('.ai-label-overlay');
    if (existingLabel) return;

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

    const parent = img.parentElement;
    parent.style.position = 'relative';
    parent.appendChild(label);
}

document.addEventListener('mouseover', function (e) {
    const img = e.target.closest('img');
    if (img) {
        processImage(img);
    }
});

// 👁️‍🗨️ Observe DOM changes (important for dynamic sites like Instagram)
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                const imgs = node.querySelectorAll?.('img');
                imgs?.forEach(img => {
                    img.addEventListener('mouseover', () => processImage(img));
                });
            }
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });
