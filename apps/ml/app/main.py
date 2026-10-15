from fastapi import FastAPI, File, HTTPException, UploadFile

from .detector import INFERENCE_MODE, detector

app = FastAPI(title="Climbing Hold Detector", version="1.0.0")


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok", "mode": INFERENCE_MODE}


@app.post("/detect")
async def detect(image: UploadFile = File(...)) -> dict:
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload.")

    try:
        return detector.detect(data)
    except HTTPException:
        raise
    except Exception as exc:  # surface decoding/model errors as a 400
        raise HTTPException(status_code=400, detail=f"Detection failed: {exc}") from exc
