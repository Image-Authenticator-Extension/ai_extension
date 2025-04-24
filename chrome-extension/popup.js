document.getElementById("analyzeBtn").addEventListener("click", () => {
    const url = document.getElementById("shortcodeInput").value;
    const match = url.match(/\/p\/([^/]+)\//);
    const shortcode = match ? match[1] : url;

    chrome.runtime.sendMessage({ action: "analyze_post", shortcode }, (response) => {
        const resultDiv = document.getElementById("result");
        resultDiv.innerHTML = '';
        response.result.forEach(({ url, label }) => {
            const item = document.createElement("div");
            item.innerHTML = `<img src="${url}" width="100"><p>${label}</p>`;
            resultDiv.appendChild(item);
        });
    });
});
