// Overlay management
function updateOverlay(el, prediction, confidence) {
    //el.style.position = 'relative';
    let overlay = el.querySelector('.ai-label-overlay');
    const labelText = (prediction === "Real" && confidence <= 0.6)
        ? `Maybe-AI`
        : `🧠 ${prediction} (${(confidence * 100).toFixed(1)}%)`;

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'ai-label-overlay';
        el.appendChild(overlay);
    }

    // Update overlay content
    overlay.innerHTML = `<div style="margin: 0; padding: 4px;">${labelText}</div>`;


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
}

// Remove overlay
function removeOverlay(el) {
    el.querySelector('.ai-label-overlay')?.remove();
}