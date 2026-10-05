"""File storage service — validates, saves, and manages uploaded images."""

import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException
from config import UPLOAD_DIR, MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS


def _ensure_dirs():
    Path(f"{UPLOAD_DIR}/original").mkdir(parents=True, exist_ok=True)
    Path(f"{UPLOAD_DIR}/annotated").mkdir(parents=True, exist_ok=True)


def validate_image(file: UploadFile) -> None:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )


def resolve_image_path(stored_path: str | None) -> str | None:
    """
    Given any stored path (relative 'uploads/...', Windows absolute, or filename),
    resolves and verifies the existing file on disk. Returns absolute path or None.
    """
    if not stored_path:
        return None
    # 1. Directly check if it's an existing absolute path
    if os.path.isabs(stored_path) and os.path.isfile(stored_path):
        return os.path.abspath(stored_path)
    
    # 2. Check relative to UPLOAD_DIR parent (backend root)
    backend_dir = Path(__file__).resolve().parent.parent
    clean_rel = stored_path.replace("\\", "/").lstrip("/")
    cand1 = os.path.abspath(os.path.join(backend_dir, clean_rel))
    if os.path.isfile(cand1):
        return cand1

    # 3. Check directly inside UPLOAD_DIR
    cand2 = os.path.abspath(os.path.join(UPLOAD_DIR, clean_rel))
    if os.path.isfile(cand2):
        return cand2

    # 4. Check inside original and annotated folders with basename
    base = os.path.basename(stored_path)
    cand3 = os.path.abspath(os.path.join(UPLOAD_DIR, "original", base))
    if os.path.isfile(cand3):
        return cand3
    cand4 = os.path.abspath(os.path.join(UPLOAD_DIR, "annotated", base))
    if os.path.isfile(cand4):
        return cand4

    # 5. Fallback check directly in cwd
    if os.path.isfile(stored_path):
        return os.path.abspath(stored_path)

    return None


async def save_original(file: UploadFile) -> tuple[str, str, str]:
    """
    Validate and save uploaded image into backend/uploads/original/.
    Returns (filename, relative_url_path, absolute_disk_path).
    Example relative_url_path: 'uploads/original/upload_abc123.jpg'
    """
    _ensure_dirs()
    validate_image(file)

    ext = Path(file.filename or "image.jpg").suffix.lower()
    unique_name = f"upload_{uuid.uuid4().hex[:12]}{ext}"
    dest = os.path.abspath(os.path.join(UPLOAD_DIR, "original", unique_name))

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_BYTES // (1024*1024)} MB.",
        )

    with open(dest, "wb") as f:
        f.write(contents)

    rel_path = f"uploads/original/{unique_name}"
    return unique_name, rel_path, dest


def annotated_path_for(filename: str) -> tuple[str, str, str]:
    """
    Returns (filename, relative_url_path, absolute_disk_path) for annotated images.
    """
    _ensure_dirs()
    dest = os.path.abspath(os.path.join(UPLOAD_DIR, "annotated", filename))
    rel_path = f"uploads/annotated/{filename}"
    return filename, rel_path, dest


def delete_files(original_path: str, annotated_path: str) -> None:
    for p in [original_path, annotated_path]:
        resolved = resolve_image_path(p)
        if resolved and os.path.isfile(resolved):
            try:
                os.remove(resolved)
            except OSError:
                pass

