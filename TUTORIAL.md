# SnapTo3D — Tutorial Deploy & Penggunaan

Arsitektur: Next.js frontend + FastAPI backend (localhost) + Modal Labs GPU (cloud inference).

---

## Prasyarat

- Python 3.11+ terinstall
- Node.js + pnpm terinstall
- Akun Modal Labs sudah login (`modal token new`)

---

## 1. Deploy Modal (sekali saja)

Dari folder `backend/`:

```
cd backend
modal deploy modal_app.py
```

Proses ini ~5 menit pertama kali (build container image di cloud).  
Selanjutnya cukup sekali per perubahan kode inference.

---

## 2. Jalankan Backend

Buka terminal baru, dari folder `backend/`:

```
cd backend
python -m uvicorn main:app --port 8000
```

Backend jalan di `http://localhost:8000`.  
Biarkan terminal ini tetap terbuka.

---

## 3. Jalankan Frontend

Buka terminal baru lagi, dari folder `frontend/`:

```
cd frontend
pnpm install
pnpm dev
```

Frontend jalan di `http://localhost:3000`.  
Buka browser ke `http://localhost:3000`.

---

## 4. Cara Pakai

1. Buka `http://localhost:3000`
2. Upload foto produk (JPG/PNG, background polos lebih bagus)
3. Klik **Generate 3D** — inference ~15-30 detik di GPU cloud
4. Model 3D muncul di viewer — bisa di-rotate, zoom, pan
5. Toggle **Auto Rotate** untuk animasi putar otomatis
6. Slider **Lighting** untuk atur intensitas cahaya
7. Klik **Download GLB** untuk simpan file 3D
8. Klik **Render & Download Video** untuk export video MP4

---

## 5. Test Inference Manual (opsional)

Untuk test langsung ke Modal tanpa frontend:

```
cd backend
modal run modal_app.py::test_inference --input-path "path/ke/foto.jpg"
```

Output disimpan sebagai `backend/output_test.glb`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend error "Modal function not found" | Jalankan `modal deploy modal_app.py` dulu |
| Frontend tidak konek ke backend | Pastikan backend jalan di port 8000 |
| Inference timeout | Foto terlalu besar, resize ke max 1024px |
| Model 3D terbalik/miring | Normal untuk beberapa foto, coba foto dari depan |
