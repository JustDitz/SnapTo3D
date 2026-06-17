"""
SnapTo3D — FastAPI Backend (60% milestone)
Orchestrator: accepts image upload, spawns Modal GPU inference,
polls task status, serves generated GLB to frontend.
"""

import asyncio
import uuid
from pathlib import Path
from typing import Literal

import modal
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# App init
# ---------------------------------------------------------------------------
app = FastAPI(title="SnapTo3D API", version="0.5.0")

# ---------------------------------------------------------------------------
# CORS — allow Next.js dev server on localhost:3000
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static files — serve placeholder GLB models + generated outputs
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "generated").mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ---------------------------------------------------------------------------
# Modal client — Konfigurasi pencarian berbasis Kelas (Cls) Cloud
# ---------------------------------------------------------------------------
MODAL_APP_NAME = "snapto3d-inference"
MODAL_CLASS_NAME = "TripoSRInference"  # Diubah dari FUNCTION menjadi CLASS

# ---------------------------------------------------------------------------
# In-memory task tracker (dev only — replace with Redis/DB for production)
# ---------------------------------------------------------------------------
TaskStatus = Literal["queued", "processing", "done", "failed"]


class Task:
    """Simple task state container."""

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.status: TaskStatus = "queued"
        self.glb_url: str | None = None
        self.error: str | None = None
        self.progress: str = "Waiting in queue..."


_tasks: dict[str, Task] = {}

# ---------------------------------------------------------------------------
# Allowed image types for upload validation
# ---------------------------------------------------------------------------
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_MB = 10


# ---------------------------------------------------------------------------
# Background worker: call Modal GPU function and update task state
# ---------------------------------------------------------------------------
async def _run_inference(task: Task, image_bytes: bytes):
    """
    Spawn Modal inference_pipeline dalam thread (Modal SDK bersifat sinkronus).
    Memperbarui status tugas seiring berjalannya pipeline di cloud.
    """
    try:
        task.status = "processing"
        task.progress = "Connecting to Modal GPU cluster..."

        # PERBAIKAN: Melakukan pencarian menggunakan komponen Cls (bukan Function)
        cls = modal.Cls.from_name(MODAL_APP_NAME, MODAL_CLASS_NAME)

        task.progress = "Running TripoSR on GPU (~15-30s)..."
        
        # PERBAIKAN: Melakukan instansiasi kelas cls() sebelum memanggil metode remote
        glb_bytes = await asyncio.to_thread(cls().inference_pipeline.remote, image_bytes)

        # Menyimpan output biner GLB hasil komputasi ke penyimpanan lokal backend
        glb_filename = f"{task.task_id}.glb"
        glb_path = STATIC_DIR / "generated" / glb_filename
        glb_path.write_bytes(glb_bytes)

        task.glb_url = f"/static/generated/{glb_filename}"
        task.status = "done"
        task.progress = "3D model generated successfully!"

    except Exception as e:
        task.status = "failed"
        task.error = str(e)
        task.progress = f"Failed: {e}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "SnapTo3D API", "version": "0.6.0"}


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """
    Menerima unggahan foto produk dari antarmuka frontend Next.js.
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: JPEG, PNG, WebP.",
        )

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Max: {MAX_FILE_SIZE_MB} MB.",
        )

    ext = Path(file.filename or "upload.jpg").suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    upload_dir = STATIC_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    file_path = upload_dir / unique_name
    file_path.write_bytes(contents)

    task_id = uuid.uuid4().hex
    task = Task(task_id)
    _tasks[task_id] = task

    # Memicu proses inferensi di background worker agar HTTP tidak membeku (hang)
    asyncio.create_task(_run_inference(task, contents))

    return JSONResponse(
        content={
            "success": True,
            "task_id": task_id,
            "image_filename": unique_name,
            "image_path": f"/static/uploads/{unique_name}",
            "message": "Image uploaded. 3D generation started. Poll /api/task/{task_id} for status.",
        },
        status_code=202,
    )


@app.get("/api/task/{task_id}")
async def get_task_status(task_id: str):
    """
    Titik akhir pengecekan berkala (polling) untuk melacak status pengerjaan model 3D.
    """
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    response = {
        "task_id": task.task_id,
        "status": task.status,
        "progress": task.progress,
    }
    if task.status == "done":
        response["glb_url"] = task.glb_url
    elif task.status == "failed":
        response["error"] = task.error

    return response


@app.get("/api/model")
async def get_stub_model():
    """
    Mengembalikan URL contoh berkas GLB statis untuk keperluan testing frontend.
    """
    return {
        "glb_url": "/static/sample.glb",
        "message": "Static placeholder model for development.",
    }