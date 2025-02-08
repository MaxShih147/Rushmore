import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';

// 1️⃣ 建立場景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

// 2️⃣ 建立攝影機
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);

// 3️⃣ 建立渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 4️⃣ 加入 OrbitControls（讓模型可旋轉、縮放）
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 5️⃣ 加入燈光
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

// 6️⃣ UI 控制面板
const gui = new dat.GUI();
const settings = {
    depthScale: 3.0, // 浮雕高度
    blurRadius: 3, // 高斯模糊半徑
    regenerate: function () {
        if (!globalHeightmap) {
            console.error("❌ 無法重新生成浮雕，heightmap 是 undefined！");
            return;
        }
        generateHeightmapMesh(globalHeightmap);
    }
};
gui.add(settings, 'depthScale', 0.1, 10, 0.1).name("浮雕高度");
gui.add(settings, 'blurRadius', 1, 10, 1).name("模糊程度").onChange(() => {
    if (!globalHeightmap) return;
    processImage(lastUploadedImage); // 重新處理圖片
});
gui.add(settings, 'regenerate').name("重新生成浮雕");

// 7️⃣ 處理圖片上傳
document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            processImage(img);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

async function fetchDepthMap(imageFile) {
    if (!(imageFile instanceof Blob)) {
        console.error("❌ fetchDepthMap: `imageFile` 不是 Blob 或 File！", imageFile);
        return null;
    }

    const base64Image = await convertToBase64(imageFile);
    if (!base64Image) {
        console.error("❌ Base64 轉換失敗！");
        return null;
    }

    console.log("📤 正在發送 Base64 圖片給 Flask...");

    let response = await fetch("http://127.0.0.1:5050/predict", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ image: base64Image })
    });

    if (!response.ok) {
        console.error("❌ 深度圖請求失敗！", await response.text());
        return null;
    }

    let blob = await response.blob();
    return URL.createObjectURL(blob);
}

// **將 File 轉換成 Base64**
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!(file instanceof Blob)) {
            console.error("❌ convertToBase64: 參數不是 Blob 或 File！", file);
            reject("Invalid file type");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}


// 8️⃣ 解析圖片並生成浮雕
// let globalHeightmap = null; // 用來存 heightmap
// let lastUploadedImage = null; // 存最新圖片
// function processImage(image) {
//     lastUploadedImage = image;

//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');

//     canvas.width = 256;
//     canvas.height = 256;
//     ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

//     // **顯示原圖**
//     const originalCanvas = document.getElementById('originalCanvas');
//     originalCanvas.width = 128;
//     originalCanvas.height = 128;
//     const originalCtx = originalCanvas.getContext('2d');
//     originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
//     originalCtx.drawImage(image, 0, 0, originalCanvas.width, originalCanvas.height);

//     // **生成灰階高度圖**
//     let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//     globalHeightmap = generateHeightmap(imgData, settings.blurRadius);

//     if (!globalHeightmap) {
//         console.error("❌ heightmap 生成失敗！");
//         return;
//     }

//     // **確保 `blurredCanvas` 內部大小正確**
//     const blurredCanvas = document.getElementById('blurredCanvas');
//     blurredCanvas.width = 256;  // **設定為 heightmap 的解析度**
//     blurredCanvas.height = 256;
//     const blurredCtx = blurredCanvas.getContext('2d');

//     // **顯示高斯模糊後的圖**
//     showBlurredHeightmap(blurredCtx, globalHeightmap, canvas.width, canvas.height);

//     // 生成浮雕
//     generateHeightmapMesh(globalHeightmap);
// }

let globalHeightmap = null; // 用來存 heightmap
let lastUploadedImage = null; // 存最新圖片
document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
        console.error("❌ 沒有選擇圖片");
        return;
    }

    processImage(file);
});

async function processImage(imageFile) {
    if (!(imageFile instanceof File)) {
        console.error("❌ processImage: `imageFile` 不是 File！", imageFile);
        return;
    }

    lastUploadedImage = imageFile;

    // 1️⃣ **等待 Flask 產生深度圖**
    let depthMapURL = await fetchDepthMap(imageFile);
    if (!depthMapURL) {
        console.error("❌ 無法獲取深度圖！");
        return;
    }

    console.log("✅ 成功取得深度圖 URL，開始載入圖像...");

    // 2️⃣ **載入深度圖**
    let depthImg = new Image();
    depthImg.src = depthMapURL;
    depthImg.onload = async () => {
        console.log("🖼️ 深度圖載入完成，顯示於 Canvas");

        // 3️⃣ **顯示深度圖**
        const depthCanvas = document.getElementById("blurredCanvas");
        const ctx = depthCanvas.getContext("2d");
        depthCanvas.width = 256;
        depthCanvas.height = 256;
        ctx.drawImage(depthImg, 0, 0, depthCanvas.width, depthCanvas.height);

        // 4️⃣ **轉換深度圖為 `heightmap`**
        let depthImage = await fetch(depthMapURL).then((res) => res.blob());
        let depthBitmap = await createImageBitmap(depthImage);

        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx2 = canvas.getContext("2d");
        ctx2.drawImage(depthBitmap, 0, 0, 256, 256);
        let imgData = ctx2.getImageData(0, 0, 256, 256);

        console.log("📊 開始轉換 depth map 為 heightmap...");
        globalHeightmap = generateHeightmap(imgData, settings.blurRadius);

        if (!globalHeightmap) {
            console.error("❌ heightmap 生成失敗！");
            return;
        }

        console.log("✅ heightmap 轉換完成，開始生成 3D 浮雕...");
        
        // 5️⃣ **生成 Mesh**
        generateHeightmapMesh(globalHeightmap);
    };
}


function showBlurredHeightmap(ctx, heightmap, width, height) {
    let imageData = ctx.createImageData(width, height);
    let data = imageData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let i = y * width + x;  // **確保索引正確**
            let brightness = heightmap[i] * 255; // **轉換成灰階值**

            let pixelIndex = i * 4; // **ImageData 需要 4 個通道（RGBA）**
            data[pixelIndex] = brightness;      // R
            data[pixelIndex + 1] = brightness;  // G
            data[pixelIndex + 2] = brightness;  // B
            data[pixelIndex + 3] = 255;         // A（不透明）
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

// 9️⃣ 生成灰階高度圖 + 高斯模糊
function generateHeightmap(imgData, blurRadius) {
    const width = imgData.width;
    const height = imgData.height;
    let pixels = imgData.data;
    let heightmap = new Float32Array(width * height);

    // 計算灰階高度
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let i = (y * width + x) * 4;
            let brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            heightmap[y * width + x] = brightness / 255; // Normalize to 0~1
        }
    }

    // **確保 return heightmap**
    return applyGaussianBlur(heightmap, width, height, blurRadius);
}

// 🔟 套用高斯模糊（簡單的 3x3 模糊卷積）
function applyGaussianBlur(heightmap, width, height, radius) {
    if (radius < 1) return heightmap; // 避免 radius 太小

    let blurred = new Float32Array(width * height);
    let kernelSize = 2 * radius + 1; // 例如 radius = 3，kernelSize = 7
    let kernel = new Array(kernelSize * kernelSize).fill(1); // 簡單平均模糊
    let kernelSum = kernel.reduce((a, b) => a + b, 0);

    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            let sum = 0;
            let index = 0;

            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    let pixel = heightmap[(y + ky) * width + (x + kx)];
                    sum += pixel * kernel[index++];
                }
            }

            blurred[y * width + x] = sum / kernelSum;
        }
    }

    return blurred;
}

// 🔟 生成 3D 浮雕模型
function generateHeightmapMesh(heightmap) {
    if (!heightmap) {
        console.error("❌ 無法生成浮雕，heightmap 是 undefined！");
        return;
    }
    console.log("✅ heightmap 有資料，開始生成 3D 浮雕");

     // **🔴 刪除舊的浮雕模型**
     const oldMesh = scene.getObjectByName("heightmapMesh");
     if (oldMesh) {
         scene.remove(oldMesh);
         oldMesh.geometry.dispose();
         oldMesh.material.dispose();
         console.log("🗑️ 舊的浮雕已刪除");
     }

    const width = 256;
    const height = 256;
    const geometry = new THREE.PlaneGeometry(5, 5, width - 1, height - 1);
    const vertices = geometry.attributes.position.array;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = Math.floor((i / 3) % width);
        const y = Math.floor((i / 3) / width);
        const heightValue = heightmap[y * width + x] || 0;
        vertices[i + 2] = heightValue * settings.depthScale;
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "heightmapMesh";

    scene.add(mesh);
}


// 🔟 動畫函數
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();