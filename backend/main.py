"""
Marine Plastic Detection & Mapping — FastAPI Backend
Serves the React frontend build AND the API from a single server.

Architecture:
  Browser → http://localhost:8000
    ├── /api/*         → FastAPI routers
    ├── /uploads/*     → Uploaded image files
    ├── /docs          → Swagger UI (dev)
    └── /*             → React SPA (index.html fallback)

Start command (from project root):
    npm run dev
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from models.database import init_db
from api.auth import router as auth_router
from api.detections import router as detections_router
from api.map import router as map_router
from api.analytics import router as analytics_router
from api.hotspots import router as hotspots_router
from api.reports import router as reports_router
from api.demo import router as demo_router
from config import UPLOAD_DIR

# Path to the compiled React build
# After running `npm run build` in frontend/, the output goes to frontend/dist/
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

app = FastAPI(
    title="Marine Plastic Detection & Mapping",
    description="B.Tech Mini Project API — Computer Vision + Geographic Mapping",
    version="1.0.0",
    # Keep docs available at /docs
)

# CORS — only needed if you ever run frontend on a separate origin during dev.
# In the single-server architecture (frontend served by FastAPI), CORS is not
# required for normal operation, but we keep it to avoid issues during testing.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve uploaded images ──────────────────────────────────────────────────
os.makedirs(f"{UPLOAD_DIR}/original", exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/annotated", exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Register API routers ───────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(detections_router)
app.include_router(map_router)
app.include_router(analytics_router)
app.include_router(hotspots_router)
app.include_router(reports_router)
app.include_router(demo_router)

@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup():
    init_db()
    print("[OK] Database initialized.")
    print("[OK] Marine Plastic Detection API running.")
    print(f"[INFO] Frontend build: {'FOUND at ' + str(FRONTEND_DIST) if FRONTEND_DIST.is_dir() else 'NOT FOUND — run npm run dev'}")
    print("[INFO] Docs: http://localhost:8000/docs")
    print("[INFO] App:  http://localhost:8000")


# ── Serve React static build ──────────────────────────────────────────────
# Mount the React build assets ONLY if the build directory exists.
# When the build is present, FastAPI serves JS/CSS/assets from /assets/*
# and returns index.html for all unmatched routes (SPA fallback).
if FRONTEND_DIST.is_dir():
    # Mount the assets subfolder so Vite's hashed filenames work
    assets_path = FRONTEND_DIST / "assets"
    if assets_path.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    @app.get("/", include_in_schema=False)
    def root():
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    # SPA catch-all: every non-API, non-file route returns index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        # Don't intercept /api/*, /uploads/*, /docs, /openapi.json, /health
        for prefix in ("api/", "uploads/", "docs", "openapi.json", "redoc", "health"):
            if full_path.startswith(prefix) or full_path == "health":
                from fastapi import HTTPException
                raise HTTPException(status_code=404)
        # Check if it's a static file in the dist folder
        static_file = FRONTEND_DIST / full_path
        if static_file.is_file():
            return FileResponse(str(static_file))
        # Fall back to index.html for all React routes
        return FileResponse(str(FRONTEND_DIST / "index.html"))
else:
    # Build not found — serve a helpful status page
    @app.get("/", include_in_schema=False)
    def root_no_build():
        return {
            "status": "API running — frontend build not found",
            "project": "Marine Plastic Detection & Mapping",
            "version": "1.0.0",
            "api_docs": "/docs",
            "instructions": (
                "Run 'npm run dev' from the project root to build the frontend "
                "and start this server. The React app will then be served at http://localhost:8000"
            ),
        }

