"""
SnapTo3D — Modal Labs Serverless GPU Inference
Deployed to Modal cloud. Runs TripoSR + rembg on GPU.

Architecture:
  Local FastAPI (orchestrator) → Modal Function (GPU) → returns GLB bytes

Deploy:  uv run modal deploy modal_app.py
Test:    uv run modal run modal_app.py::test_inference --input-path photo.jpg
"""

import logging
import sys
from io import BytesIO
import modal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)

# ---------------------------------------------------------------------------
# Modal App definition
# ---------------------------------------------------------------------------
app = modal.App("snapto3d-inference")

# ---------------------------------------------------------------------------
# Container Image — CUDA devel base + Compilers + PyTorch + TripoSR
# ---------------------------------------------------------------------------
image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "ninja-build", "python3-pip", "build-essential", "clang")
    .pip_install(
        "torch==2.4.0",
        "torchvision==0.19.0",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .run_commands(
        "git clone https://github.com/VAST-AI-Research/TripoSR.git /opt/TripoSR",
    )
    .env({"TORCH_CUDA_ARCH_LIST": "7.5;8.0;8.6"})
    # Install only inference dependencies — skip gradio/imageio-ffmpeg (TripoSR web UI, unused here).
    # onnxruntime-gpu pinned to 1.18.0: latest (2.x) requires CUDA 13, container has CUDA 12.1.1.
    .pip_install(
        "numpy<2",  # onnxruntime-gpu 1.18.0 compiled for NumPy 1.x; 2.x breaks _ARRAY_API
        "omegaconf==2.3.0",
        "Pillow==10.1.0",
        "einops==0.7.0",
        "transformers==4.35.0",
        "trimesh==4.0.5",
        "huggingface-hub==0.17.3",
        "imageio==2.33.1",
        "xatlas==0.0.9",
        "moderngl==5.10.0",
        "onnxruntime-gpu==1.18.0",
        "rembg==2.0.57",
        "scipy",
        "scikit-image",
    )
    .run_commands(
        "pip install 'git+https://github.com/tatsy/torchmcubes.git'",
    )
    # Pre-download TripoSR weights into the image layer so cold start skips the 1.68GB download
    .env({"HF_HOME": "/root/.cache/huggingface", "PYTHONPATH": "/opt/TripoSR"})
    .run_commands(
        "python -c \"from huggingface_hub import snapshot_download; snapshot_download('stabilityai/TripoSR')\"",
    )
    .env({"HF_HOME": "/root/.cache/huggingface", "PYTHONPATH": "/opt/TripoSR"})
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
@app.cls(image=image, gpu="T4", timeout=600, container_idle_timeout=300)
class TripoSRInference:
    @modal.enter()
    def load_model(self):
        import torch
        from tsr.system import TSR

        log = logging.getLogger("modal.load_model")
        log.info("Container cold start — loading TripoSR weights from HuggingFace...")
        log.info(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            log.info(f"GPU: {torch.cuda.get_device_name(0)}")

        self.model = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt",
        )
        self.model.renderer.set_chunk_size(8192)
        self.model.to("cuda:0")
        log.info("Model loaded on cuda:0 — container warm, ready for inference")

    @modal.method()
    def inference_pipeline(self, image_bytes: bytes) -> bytes:
        import time
        import torch
        import tempfile
        import os

        log = logging.getLogger("modal.inference")
        t0 = time.time()

        def elapsed() -> str:
            return f"{time.time() - t0:.1f}s"

        log.info(f"[{elapsed()}] Pipeline start — image size: {len(image_bytes) / 1024:.1f} KB")

        log.info(f"[{elapsed()}] Step 1/4: Preprocessing (rembg background removal)...")
        try:
            processed_image = _preprocess_image(image_bytes)
            log.info(f"[{elapsed()}] Step 1/4 done — image: {processed_image.size}")
        except Exception as e:
            log.error(f"[{elapsed()}] Step 1/4 FAILED: {e}")
            raise

        log.info(f"[{elapsed()}] Step 2/4: TripoSR inference on GPU...")
        try:
            with torch.no_grad():
                scene_codes = self.model([processed_image], device="cuda:0")
            log.info(f"[{elapsed()}] Step 2/4 done")
        except Exception as e:
            log.error(f"[{elapsed()}] Step 2/4 FAILED: {e}")
            raise

        log.info(f"[{elapsed()}] Step 3/4: Mesh extraction (marching cubes, res=256)...")
        try:
            meshes = self.model.extract_mesh(scene_codes, True, resolution=256)
            log.info(f"[{elapsed()}] Step 3/4 done — {len(meshes)} mesh(es)")
        except Exception as e:
            log.error(f"[{elapsed()}] Step 3/4 FAILED: {e}")
            raise

        log.info(f"[{elapsed()}] Step 4/4: Exporting GLB...")
        import numpy as np
        import trimesh.transformations as tf
        # TripoSR outputs in camera-relative coords — rotate -90° around X to stand upright
        meshes[0].apply_transform(tf.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        tmp_path = tempfile.mktemp(suffix=".glb")
        try:
            meshes[0].export(tmp_path, file_type="glb")
            with open(tmp_path, "rb") as f:
                glb_bytes = f.read()
        except Exception as e:
            log.error(f"[{elapsed()}] Step 4/4 FAILED: {e}")
            raise
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        log.info(f"[{elapsed()}] Pipeline complete — GLB: {len(glb_bytes) / 1024:.1f} KB")
        return glb_bytes


# ---------------------------------------------------------------------------
# Local test entrypoint — Menjalankan pengujian dari komputer lokal Anda
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def test_inference(input_path: str):
    """
    Eksekusi perintah pengujian lewat terminal lokal:
    uv run modal run modal_app.py::test_inference --input-path foto_produk.jpg
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
