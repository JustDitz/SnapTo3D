"""
SnapTo3D — Modal Labs Serverless GPU Inference
Deployed to Modal cloud. Runs TripoSR + rembg on GPU.

Architecture:
  Local FastAPI (orchestrator) → Modal Function (GPU) → returns GLB bytes

Deploy:  modal deploy modal_app.py
Test:    modal run modal_app.py::test_inference --input-path photo.jpg
"""

import logging
from io import BytesIO
import modal

# ---------------------------------------------------------------------------
# Modal App definition
# ---------------------------------------------------------------------------
app = modal.App("snapto3d-inference")

# ---------------------------------------------------------------------------
# Container Image — CUDA devel base + Compilers + PyTorch + TripoSR
# ---------------------------------------------------------------------------
image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.11")
    # Memasang perkakas kompiler sistem
    .apt_install("git", "ninja-build", "python3-pip", "build-essential", "clang")
    # PyTorch dengan dukungan CUDA 12.1
    .pip_install(
        "torch==2.4.0",
        "torchvision==0.19.0",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    # Pasang onnxruntime-gpu secara eksplisit untuk rembg
    .pip_install("onnxruntime-gpu")
    # Kloning repositori resmi TripoSR ke dalam folder opt
    .run_commands(
        "git clone https://github.com/VAST-AI-Research/TripoSR.git /opt/TripoSR",
    )
    # PERBAIKAN MUTLAK: Paksa nvcc untuk mengompilasi arsitektur Turing (7.5 untuk T4), Ampere (8.0/8.6)
    .env({"TORCH_CUDA_ARCH_LIST": "7.5;8.0;8.6"})
    # Pustaka torchmcubes kini akan dibangun dengan instruksi yang dipahami oleh GPU T4
    .run_commands(
        "pip install -r /opt/TripoSR/requirements.txt",
    )
    # Mendaftarkan tsr ke dalam variabel path environment Python
    .env({"PYTHONPATH": "/opt/TripoSR"})
)


# ---------------------------------------------------------------------------
# Preprocessing helper: background removal + foreground resize
# ---------------------------------------------------------------------------
def _preprocess_image(image_bytes: bytes):
    """
    Remove background and resize foreground to fit TripoSR input.
    Returns a PIL Image with gray background, ready for model.
    """
    import numpy as np
    from PIL import Image
    import rembg
    from tsr.utils import remove_background, resize_foreground

    rembg_session = rembg.new_session()
    pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")

    # Tahap 1: Penghapusan latar belakang otomatis
    transparent = remove_background(pil_image, rembg_session)

    # Tahap 2: Ubah ukuran objek ke skala 85% sesuai konvensi TripoSR
    resized = resize_foreground(transparent, 0.85)

    # Tahap 3: Satukan objek ke latar belakang abu-abu (TripoSR menerima format RGB)
    arr = np.array(resized).astype(np.float32) / 255.0
    rgb_on_gray = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
    processed = Image.fromarray((rgb_on_gray * 255.0).astype(np.uint8))

    return processed


# ---------------------------------------------------------------------------
# GPU CLASS: Mengamankan siklus hidup model di dalam kluster GPU cloud
# ---------------------------------------------------------------------------
@app.cls(image=image, gpu="T4", timeout=120)
class TripoSRInference:
    @modal.enter()
    def load_model(self):
        """Memuat bobot model sekali saja saat penampung pertama kali dinyalakan (Cold Start)"""
        import torch
        from tsr.system import TSR

        logging.info("[TripoSR] Loading model weights from HuggingFace...")
        self.model = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt",
        )
        self.model.renderer.set_chunk_size(8192)
        self.model.to("cuda:0")
        logging.info("[TripoSR] Model successfully loaded on cuda:0")

    @modal.method()
    def inference_pipeline(self, image_bytes: bytes) -> bytes:
        """Eksekusi konversi gambar mentah menjadi model 3D biner (.GLB)"""
        import torch
        import tempfile
        import os

        logging.info("[Pipeline] Starting inference pipeline...")

        # Pembersihan background secara lokal di dalam container
        logging.info("[Pipeline] Preprocessing image (rembg)...")
        processed_image = _preprocess_image(image_bytes)

        # Proses inferensi neural network TripoSR
        logging.info("[Pipeline] Running TripoSR model...")
        with torch.no_grad():
            scene_codes = self.model([processed_image], device="cuda:0")

        # Ekstraksi bentuk geometri menggunakan algoritma marching cubes
        logging.info("[Pipeline] Extracting mesh (marching cubes)...")
        meshes = self.model.extract_mesh(scene_codes, True, resolution=256)

        # Ekspor bentuk geometri ke dalam berkas GLB temporer
        logging.info("[Pipeline] Exporting GLB...")
        tmp_path = tempfile.mktemp(suffix=".glb")
        try:
            meshes[0].export(tmp_path, file_type="glb")
            with open(tmp_path, "rb") as f:
                glb_bytes = f.read()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        size_kb = len(glb_bytes) / 1024
        logging.info(f"[Pipeline] Done! GLB size: {size_kb:.1f} KB")
        return glb_bytes


# ---------------------------------------------------------------------------
# Local test entrypoint — Menjalankan pengujian dari komputer lokal Anda
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def test_inference(input_path: str):
    """
    Eksekusi perintah pengujian lewat terminal lokal:
    modal run modal_app.py::test_inference --input-path foto_produk.jpg
    """
    import os

    if not os.path.exists(input_path):
        print(f"Error: File tidak ditemukan pada jalur: {input_path}")
        return

    with open(input_path, "rb") as f:
        image_bytes = f.read()

    print(f"Mengirim data gambar ke kluster GPU Modal Labs...")
    
    # Memanggil fungsi di dalam kelas melalui perantara .remote()
    inference_instance = TripoSRInference()
    glb_bytes = inference_instance.inference_pipeline.remote(image_bytes)

    output_path = "output_test.glb"
    with open(output_path, "wb") as f:
        f.write(glb_bytes)

    print(f"Sukses! Berkas 3D berhasil disimpan di: {output_path} ({len(glb_bytes) / 1024:.1f} KB)")