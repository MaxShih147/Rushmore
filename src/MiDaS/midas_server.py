from flask import Flask, request, jsonify, send_file
import torch
import cv2
import numpy as np
import base64
import io
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 載入 MiDaS 模型
midas = torch.hub.load("intel-isl/MiDaS", "DPT_Large")
midas.eval()

# **Base64 解析函數**
def decode_base64_image(base64_string):
    try:
        print("🔍 嘗試解碼 Base64 圖片...")
        base64_data = base64_string.split(",")[1]  # 移除 "data:image/jpeg;base64,"
        image_data = base64.b64decode(base64_data)
        np_arr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            print("❌ OpenCV 讀取圖片失敗！")
        else:
            print(f"✅ 圖片成功解碼，尺寸: {img.shape}")

        return img
    except Exception as e:
        print("❌ Base64 解析錯誤:", e)
        return None

# **預測深度函數**
def predict_depth(image):
    try:
        print("🔍 開始 MiDaS 深度預測...")
        img = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (1024, 1024))
        img = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0).float() / 255.0

        with torch.no_grad():
            depth_map = midas(img).squeeze().cpu().numpy()

        depth_map = cv2.normalize(depth_map, None, 0, 255, cv2.NORM_MINMAX)
        depth_map = cv2.resize(depth_map, (image.shape[1], image.shape[0]))

        print("✅ 深度圖預測完成！")
        return depth_map.astype(np.uint8)
    except Exception as e:
        print("❌ 深度預測錯誤:", e)
        return None

# **Flask API**
@app.route("/predict", methods=["POST"])
def predict():
    try:
        # **檢查 `Content-Type` 是否正確**
        if request.content_type != "application/json":
            print(f"❌ 錯誤的 Content-Type: {request.content_type}")
            return jsonify({"error": "Unsupported Media Type, expected application/json"}), 415

        data = request.json  # ✅ 確保 Flask 解析 JSON
        if "image" not in data:
            print("❌ 沒有收到 `image` 欄位")
            return jsonify({"error": "No image data provided"}), 400
        
        img = decode_base64_image(data["image"])
        if img is None:
            return jsonify({"error": "Invalid Base64 image"}), 400
        
        depth_map = predict_depth(img)
        if depth_map is None:
            return jsonify({"error": "Depth prediction failed"}), 500
        
        _, encoded_img = cv2.imencode(".png", depth_map)
        return send_file(io.BytesIO(encoded_img), mimetype="image/png")

    except Exception as e:
        print("❌ 伺服器錯誤:", e)
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
