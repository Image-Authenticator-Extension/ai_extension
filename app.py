from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from io import BytesIO
import base64
import torch
from transformers import ViTForImageClassification, ViTImageProcessor

# Load model and processor
model = ViTForImageClassification.from_pretrained(
    "Recent_Trained_Model",
    local_files_only=True,
    trust_remote_code=True
)

processor = ViTImageProcessor.from_pretrained("Recent_Trained_Model")

model.eval()  # Set model to evaluation mode

app = Flask(__name__)
CORS(app)

def preprocess_image(image):
    return processor(images=image, return_tensors="pt")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        image_base64 = data.get('image')

        if not image_base64:
            return jsonify({'error': 'No image data provided'}), 400

        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]

        image_bytes = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_bytes)).convert("RGB")

        inputs = preprocess_image(image)

        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=1)
            predicted_class = torch.argmax(probs, dim=1).item()
            confidence = torch.max(probs).item()

        return jsonify({
            'prediction': 'AI' if predicted_class == 0 else 'Real',
            'confidence': confidence
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
