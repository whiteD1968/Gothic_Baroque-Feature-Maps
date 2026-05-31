import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.process import router as process_router

app = FastAPI(title="Gothic / Baroque Feature Extraction Tool")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
UPLOAD_DIR = os.path.join(BASE_DIR, "public", "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "public", "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app.include_router(process_router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
