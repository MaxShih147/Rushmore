# 🚀 Rushmore - 2D to 3D Relief Model Generator

**Rushmore** is a tool that converts **2D images** into **3D relief models**, making it ideal for **3D printing**, **digital art**, and **sculpting**.

![Rushmore Preview](https://via.placeholder.com/800x400?text=Project+Preview)  
*Example of a 3D relief model generated from an image.*

---

## 📌 Features
✅ **Upload any 2D image** (JPG, PNG)  
✅ **Depth estimation using MiDaS** (or use iPhone LiDAR depth maps)  
✅ **Apply Gaussian blur for smoother heightmaps**  
✅ **Generate 3D mesh from depth data**  
✅ **Preview in Three.js with real-time controls**  
✅ **Export as STL / OBJ for 3D printing**  

---

## 🛠️ Tech Stack
### **Frontend**
- **Three.js** – 3D rendering  
- **dat.GUI** – UI controls for parameter tuning  
- **Vite** – Fast development environment  

### **Backend**
- **Flask** – API server  
- **MiDaS** – Deep learning-based depth estimation  
- **OpenCV** – Image processing  
