// Get the absolute URL to the CSS file
const cssUrl = chrome.runtime.getURL('styles.css');

// Fetch and inject the CSS
fetch(cssUrl)
  .then(response => response.text())
  .then(cssText => {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);
  });

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
