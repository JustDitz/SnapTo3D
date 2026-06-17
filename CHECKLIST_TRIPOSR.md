# SnapTo3D — Checklist Menuju Integrasi TripoSR

## Status Saat Ini: 60% (scaffold UI + backend orchestrator + Modal GPU code selesai)

**Keputusan Arsitektur:**
- GPU Lokal RTX 4050 (6 GB VRAM) → **SKIP** (TripoSR butuh min 8 GB)
- Kaggle → **SKIP** (sesi timeout, ngrok tidak stabil)
- **Modal Labs Serverless GPU** → dipilih untuk inference TripoSR
- FastAPI lokal = orchestrator/penerima request saja

---

## [x] 1. ~~Persiapan Environment GPU~~ (SKIP — pakai Modal cloud)

RTX 4050 Laptop 6 GB VRAM tidak cukup. Semua inference jalan di Modal T4 (16 GB VRAM).

---

## [x] 2. ~~Install Dependencies TripoSR Lokal~~ (SKIP — jalan di Modal container)

Dependencies (torch, tripo3, rembg, dll) sudah didefinisikan di `modal_app.py` sebagai Modal Image.
Lokal hanya butuh `modal` client + `fastapi` + `uvicorn`.

---

## [x] 3. Background Removal Pipeline (DONE — di dalam modal_app.py)

- [x] Fungsi `_preprocess_image()` di `modal_app.py`
- [x] Pakai `rembg` + TripoSR `remove_background()` + `resize_foreground()`
- [x] Output: RGB image dengan gray background, siap untuk TripoSR

---

## [x] 4. TripoSR Inference Service (DONE — modal_app.py)

- [x] `modal_app.py` dengan `modal.App("snapto3d-inference")`
- [x] Container image: PyTorch CUDA 12.1 + TripoSR + rembg + trimesh
- [x] `@app.function(gpu="T4") inference_pipeline(image_bytes) -> glb_bytes`
- [x] Model loading via `_load_model()` (cached per container)
- [x] Mesh extraction + GLB export via trimesh

---

## [x] 5. Async Task System (DONE — asyncio + in-memory dict)

- [x] `asyncio.create_task()` + `_tasks` dict di `main.py`
- [x] Return `task_id` (HTTP 202) saat upload
- [x] Endpoint `GET /api/task/{task_id}` → status polling
- [x] Frontend polling setiap 2 detik di `UploadZone.tsx`

---

## [x] 6. ~~Storage Cloudflare R2~~ (DITUNDA — local storage cukup untuk dev)

- [x] Local storage: `backend/static/generated/{task_id}.glb`
- [ ] Cloudflare R2 bucket (nanti di tahap production)

---

## [x] 7. Backend Endpoint (DONE)

- [x] `POST /api/upload` → simpan gambar + spawn Modal task + return task_id
- [x] `GET /api/task/{task_id}` → return status/progress/glb_url
- [x] `GET /api/model` → stub GLB untuk testing tanpa upload
- [x] Modal function lookup via `modal.Function.from_name()`

---

## [x] 8. Frontend: Loading State & Polling (DONE)

- [x] `UploadZone.tsx` → processing state (uploading → generating 3D → done)
- [x] Polling loop via `useEffect` setiap 2 detik ke `/api/task/{id}`
- [x] Progress indicator: spinner + pesan status dari backend
- [x] Success/failure UI states
- [x] `ThreeScene.tsx` auto-load GLB saat `modelUrl` berubah

---

## [ ] 9. DEPLOY MODAL — Langkah yang Harus Dilakukan

Ini langkah manual yang kamu perlu jalankan:

### 9.1 Buat Akun Modal Labs
- [ ] Daftar di https://modal.com (free tier: $30 GPU credit/bulan)
- [ ] Install Modal CLI: `python -m pip install modal`
- [ ] Setup token: `modal token new` (buka browser auth)

### 9.2 Deploy Function ke Modal Cloud
```powershell
cd e:\Coding\Python\Grafkom\FP\backend
modal deploy modal_app.py
```

Output yang diharapkan:
```
✓ Initialized.
✓ Created objects.
├── 🔨 Created inference_pipeline.
├── 🔨 Created health_check.
✓ App deployed! 🎉
View Deployment: https://modal.com/apps/<your-user>/snapto3d-inference
```

### 9.3 Test dari Lokal (tanpa FastAPI)
```powershell
modal run modal_app.py::test_inference --input-path path/to/photo.jpg
```
Harusnya menghasilkan `output_test.glb` di folder yang sama.

### 9.4 Setup Auth untuk FastAPI → Modal
FastAPI lokal butuh Modal token untuk memanggil function:
```powershell
# Set environment variables (atau buat .env file)
$env:MODAL_TOKEN_ID = "ak-xxxxx"
$env:MODAL_TOKEN_SECRET = "sk-xxxxx"

# Atau pastikan ~/.modal.toml ada (dari modal token new)
```

### 9.5 Run Full Stack
```powershell
# Terminal 1: Backend FastAPI
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend Next.js
cd frontend
npm run dev
```

---

## [ ] 10. Testing End-to-End

- [ ] Deploy Modal berhasil (`modal deploy modal_app.py`)
- [ ] `modal run modal_app.py::test_inference` menghasilkan GLB valid
- [ ] FastAPI auth ke Modal berhasil (token configured)
- [ ] Upload gambar di frontend → task_id diterima
- [ ] Polling menampilkan progress (queued → processing → done)
- [ ] GLB hasil TripoSR tampil di ThreeScene
- [ ] Polling stop otomatis saat task selesai

---

## Ringkasan Alur Saat Ini (60%)

```
[User Upload Foto di Frontend]
       ↓
[FastAPI POST /api/upload → simpan gambar + return task_id]
       ↓
[asyncio.create_task → modal.Function.from_name().remote()]
       ↓
[Modal Cloud T4 GPU: rembg → TripoSR → GLB bytes]  ← ~30-60 detik
       ↓
[FastAPI simpan .glb ke static/generated/]
       ↓
[Frontend polling GET /api/task/{id} → status=done → glb_url]
       ↓
[ThreeScene render model 3D]
```

---

## File yang Berubah di Tahap Ini

| File | Perubahan |
|------|-----------|
| `backend/modal_app.py` | **BARU** — Modal GPU inference function |
| `backend/main.py` | **UPDATE** — tambah modal client, async task, polling endpoint |
| `backend/requirements.txt` | **UPDATE** — tambah `modal`, `python-dotenv` |
| `frontend/components/UploadZone.tsx` | **UPDATE** — polling state, processing UI |
| `frontend/app/page.tsx` | **UPDATE** — version text |
