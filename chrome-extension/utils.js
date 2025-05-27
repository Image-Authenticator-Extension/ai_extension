function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// Find Image
function findImageElement(el) {
    if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName)) return null;

    const queue = [el];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || !current.tagName) continue;

        const url = extractImageURL(current);
        if (url) 
            {
                  
                return { el: current, url };
    }
        for (const child of current.children) {
            queue.push(child);
        }
    }

    return null;
}

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

function extractImageURL(el) {
    if (el.tagName === 'IMG' && el.src) return el.src;
    if (el.tagName === 'IMG' && el.srcset) return el.srcset.split(',')[0].trim().split(' ')[0];
    const bg = window.getComputedStyle(el).getPropertyValue('background-image');
    if (bg && bg !== 'none') {
        const match = bg.match(/url\(["']?(.*?)["']?\)/);
        if (match) return match[1];
    }
    return null;
}
