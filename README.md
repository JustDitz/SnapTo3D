<div align="center">

<div>
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Three.js-r170-white?style=flat-square&logo=threedotjs" alt="Three.js">
  <img src="https://img.shields.io/badge/GPU-Modal_Labs-7B61FF?style=flat-square" alt="Modal Labs">
  <img src="https://img.shields.io/badge/AI-TripoSR-FF6B6B?style=flat-square" alt="TripoSR">
</div>

<br>

# SnapTo3D

**Turn a single product photo into an interactive 3D model — right in the browser.**

A web platform designed for Indonesian MSMEs (UMKM) to create 3D product presentations from a single image, with zero installation and no technical expertise required.

[Features](#features) · [Architecture](#architecture) · [Getting Started](#getting-started) · [Tech Stack](#tech-stack)

</div>

---

## Features

- **Drag-and-Drop Upload** — Upload a product photo (JPEG, PNG, WebP up to 10 MB) with instant preview and client-side validation.
- **AI-Powered 3D Reconstruction** — TripoSR neural network running on a serverless GPU (Modal Labs) converts a single image into a GLB mesh in ~15–30 seconds.
- **Interactive 3D Viewer** — Three.js viewport with orbit controls (rotate, zoom, pan), auto-centering, ACES filmic tone mapping, and multi-light setup.
- **Real-Time Task Polling** — Progress indicators track each pipeline stage from queue to completion.
- **Responsive UI** — Dark-themed interface with a two-panel layout that adapts to mobile and desktop.

### Planned Features

- Lighting controls (position, intensity, shadow toggle)
- Animation controls (auto-rotate speed, duration)
- GLB/OBJ export via Cloudflare R2 signed URLs
- MP4 video export via MediaRecorder + ffmpeg.wasm (client-side, Web Worker)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│  Next.js     │────▶│  FastAPI      │────▶│  Modal Labs GPU   │
│  Frontend    │◀────│  Backend      │◀────│  TripoSR + rembg  │
│  :3000       │     │  :8000        │     │  T4 / A10G        │
└─────────────┘     └──────────────┘     └───────────────────┘
       │                    │
       │  /api/* rewrites   │  GLB bytes
       │  via next.config   │
       ▼                    ▼
  Three.js Viewer     static/generated/
```

**Pipeline flow:**

1. User uploads a product photo via the Next.js frontend
2. Frontend proxies the request to FastAPI (`POST /api/upload`)
3. FastAPI saves the image, creates an async task, and calls Modal GPU
4. Modal container runs: background removal (rembg) → TripoSR inference → marching cubes → GLB export
5. FastAPI saves the GLB locally and marks the task as done
6. Frontend polls `GET /api/task/{id}` every 2 seconds, then loads the GLB into the Three.js viewer

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Modal CLI** — `pip install modal` then `modal setup`

### Backend

```bash
cd backend

# Create a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
python -m pip install -r requirements.txt

# Deploy the GPU inference app to Modal
modal deploy modal_app.py

# Start the FastAPI server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server (proxies /api/* to FastAPI on :8000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> [!TIP]
> Click **"Muat Model Demo"** to load a static GLB sample and test the 3D viewer without running the GPU pipeline.

### Test GPU Inference Locally

```bash
cd backend
modal run modal_app.py::test_inference --input-path path/to/photo.jpg
```

This sends an image to Modal's GPU cluster and saves the output as `output_test.glb`.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Next.js 15, Tailwind CSS 3 |
| **3D Rendering** | Three.js r170 (WebGL, OrbitControls, GLTFLoader) |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **AI Inference** | TripoSR (MIT license), rembg |
| **GPU Infrastructure** | Modal Labs — serverless T4, CUDA 12.1 |
| **Container Image** | `nvidia/cuda:12.1.1-devel-ubuntu22.04` |

## Project Structure

```
FP/
├── backend/
│   ├── main.py              # FastAPI app — upload, task polling, static serving
│   ├── modal_app.py         # Modal GPU app — TripoSR inference pipeline
│   ├── requirements.txt     # Python dependencies
│   └── static/              # Uploaded images + generated GLB files
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main layout — upload panel + 3D viewer
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Tailwind + dark theme variables
│   ├── components/
│   │   ├── ThreeScene.tsx   # Three.js canvas with lighting & GLB loader
│   │   └── UploadZone.tsx   # Drag-and-drop uploader with task polling
│   └── next.config.ts       # API/static rewrites to FastAPI backend
└── prd.md                   # Product requirements document
```

## Known Limitations

- Reconstruction quality degrades for transparent, reflective, or highly glossy objects.
- TripoSR cannot reconstruct occluded surfaces (hidden geometry is estimated by the model).
- GPU inference requires an active Modal account and internet connection.
- In-memory task storage is not persistent — tasks are lost on server restart (production will use Redis/DB).
