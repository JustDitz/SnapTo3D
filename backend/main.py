"""
SnapTo3D — FastAPI Backend
Orchestrator: accepts image upload, spawns Modal GPU inference,
polls task status, serves generated GLB to frontend.
"""

import asyncio
import hashlib
import logging
import sys
import uuid
from pathlib import Path
from typing import Literal

import modal
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)
log = logging.getLogger("snapto3d")

# ---------------------------------------------------------------------------
# App init
# ---------------------------------------------------------------------------
app = FastAPI(title="SnapTo3D API", version="0.7.0")

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
# Static files
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "generated").mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ---------------------------------------------------------------------------
# Modal config
# ---------------------------------------------------------------------------
MODAL_APP_NAME = "snapto3d-inference"
MODAL_CLASS_NAME = "TripoSRInference"
MODAL_TIMEOUT_SECONDS = 300  # 5 minutes — fail loudly instead of hanging forever

# ---------------------------------------------------------------------------
# In-memory task tracker
# ---------------------------------------------------------------------------
TaskStatus = Literal["queued", "processing", "done", "failed"]


class Task:
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.status: TaskStatus = "queued"
        self.glb_url: str | None = None
        self.error: str | None = None
        self.progress: str = "Waiting in queue..."


_tasks: dict[str, Task] = {}
_photo_cache: dict[str, str] = {}  # sha256 → glb_url

# ---------------------------------------------------------------------------
# Allowed image types
# ---------------------------------------------------------------------------
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_MB = 10


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------
def _set_progress(task: Task, msg: str) -> None:
    task.progress = msg
    log.info(f"[task:{task.task_id[:8]}] {msg}")


async def _run_inference(task: Task, image_bytes: bytes, photo_hash: str):
    try:
        _set_progress(task, "Connecting to Modal GPU cluster...")
        task.status = "processing"

        cls = modal.Cls.from_name(MODAL_APP_NAME, MODAL_CLASS_NAME)
        _set_progress(task, "Modal connected — waiting for GPU container (cold start may take ~2 min)...")

        try:
            glb_bytes = await asyncio.wait_for(
                asyncio.to_thread(cls().inference_pipeline.remote, image_bytes),
                timeout=MODAL_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            raise RuntimeError(
                f"Modal inference timed out after {MODAL_TIMEOUT_SECONDS}s. "
                "Try again — container may need more time on cold start."
            )

        _set_progress(task, f"GLB received ({len(glb_bytes) / 1024:.0f} KB) — saving...")

        glb_filename = f"{task.task_id}.glb"
        glb_path = STATIC_DIR / "generated" / glb_filename
        glb_path.write_bytes(glb_bytes)

        task.glb_url = f"/static/generated/{glb_filename}"
        task.status = "done"
        _set_progress(task, f"Done — {len(glb_bytes) / 1024:.0f} KB GLB ready")
        _photo_cache[photo_hash] = task.glb_url

    except Exception as e:
        task.status = "failed"
        task.error = str(e)
        task.progress = f"Failed: {e}"
        log.error(f"[task:{task.task_id[:8]}] FAILED — {e}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"status": "ok", "service": "SnapTo3D API", "version": "0.7.0"}


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
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

    photo_hash = hashlib.sha256(contents).hexdigest()
    log.info(f"Upload received — {file.filename} ({size_mb:.2f} MB) hash={photo_hash[:12]}...")

    # Cache hit — return instantly
    if photo_hash in _photo_cache:
        log.info(f"Cache hit for hash={photo_hash[:12]} — skipping Modal inference")
        cached_task_id = uuid.uuid4().hex
        cached_task = Task(cached_task_id)
        cached_task.status = "done"
        cached_task.glb_url = _photo_cache[photo_hash]
        cached_task.progress = "Returned from cache (same photo processed before)."
        _tasks[cached_task_id] = cached_task
        return JSONResponse(
            content={
                "success": True,
                "task_id": cached_task_id,
                "cached": True,
                "message": "Cache hit. Poll /api/task/{task_id} for GLB URL.",
            },
            status_code=202,
        )

    ext = Path(file.filename or "upload.jpg").suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    upload_dir = STATIC_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    (upload_dir / unique_name).write_bytes(contents)

    task_id = uuid.uuid4().hex
    task = Task(task_id)
    _tasks[task_id] = task

    log.info(f"New task created — id={task_id[:8]} file={unique_name}")
    asyncio.create_task(_run_inference(task, contents, photo_hash))

    return JSONResponse(
        content={
            "success": True,
            "task_id": task_id,
            "image_filename": unique_name,
            "message": "Upload OK — 3D generation started. Poll /api/task/{task_id}.",
        },
        status_code=202,
    )


@app.get("/api/task/{task_id}")
async def get_task_status(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    log.debug(f"Poll task={task_id[:8]} status={task.status}")

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
    return {
        "glb_url": "/static/sample.glb",
        "message": "Static placeholder model for development.",
    }
