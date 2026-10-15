"""Hold detection with a pluggable inference backend.

Set INFERENCE_MODE=yolo (default) or INFERENCE_MODE=sahi to choose how the
Ultralytics model is executed. Both paths emit normalized (0..1) bounding boxes
in the same shape so the API is agnostic to the mode.
"""

import io
import os

import numpy as np
from PIL import Image

MODEL_PATH = os.getenv("MODEL_PATH", "best4.pt")
INFERENCE_MODE = os.getenv("INFERENCE_MODE", "yolo").strip().lower()

YOLO_CONF = float(os.getenv("YOLO_CONF", "0.3"))
YOLO_IOU = float(os.getenv("YOLO_IOU", "0.2"))
IMGSZ = int(os.getenv("IMGSZ", "1280"))

SAHI_CONF = float(os.getenv("SAHI_CONF", "0.45"))
SAHI_OVERLAP = float(os.getenv("SAHI_OVERLAP", "0.2"))

# Detections whose area exceeds this fraction of the image are discarded.
# Ported from the original scripts' "large box" filter (image_area / 25).
MAX_BOX_AREA_FRACTION = float(os.getenv("MAX_BOX_AREA_FRACTION", "0.04"))


class HoldDetector:
    def __init__(self) -> None:
        if INFERENCE_MODE not in ("yolo", "sahi"):
            raise ValueError(f"Unknown INFERENCE_MODE: {INFERENCE_MODE!r}")

        self.mode = INFERENCE_MODE

        if self.mode == "sahi":
            from sahi import AutoDetectionModel

            self._sahi_model = AutoDetectionModel.from_pretrained(
                model_type="ultralytics",
                model_path=MODEL_PATH,
                confidence_threshold=SAHI_CONF,
                device="cpu",
            )
            self._model = None
        else:
            from ultralytics import YOLO

            self._model = YOLO(MODEL_PATH)
            self._sahi_model = None

    def detect(self, image_bytes: bytes) -> dict:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        width, height = image.size

        if self.mode == "sahi":
            holds = self._detect_sahi(np.asarray(image), width, height)
        else:
            holds = self._detect_yolo(np.asarray(image))

        holds = [h for h in holds if h["width"] * h["height"] <= MAX_BOX_AREA_FRACTION]

        return {
            "image_width": width,
            "image_height": height,
            "mode": self.mode,
            "holds": holds,
        }

    def _detect_yolo(self, image_array: np.ndarray) -> list[dict]:
        results = self._model.predict(
            source=image_array,
            conf=YOLO_CONF,
            iou=YOLO_IOU,
            imgsz=IMGSZ,
            verbose=False,
        )

        holds: list[dict] = []
        for result in results:
            for box in result.boxes:
                x_center, y_center, w, h = box.xywhn[0].tolist()
                holds.append(
                    {
                        "x_center": float(x_center),
                        "y_center": float(y_center),
                        "width": float(w),
                        "height": float(h),
                        "confidence": float(box.conf[0]),
                    }
                )
        return holds

    def _detect_sahi(self, image_array: np.ndarray, width: int, height: int) -> list[dict]:
        from sahi.predict import get_sliced_prediction

        result = get_sliced_prediction(
            image_array,
            self._sahi_model,
            slice_height=max(1, height // 2),
            slice_width=max(1, width // 2),
            overlap_height_ratio=SAHI_OVERLAP,
            overlap_width_ratio=SAHI_OVERLAP,
        )

        holds: list[dict] = []
        for prediction in result.object_prediction_list:
            x, y, w, h = prediction.bbox.to_xywh()
            holds.append(
                {
                    "x_center": float((x + w / 2) / width),
                    "y_center": float((y + h / 2) / height),
                    "width": float(w / width),
                    "height": float(h / height),
                    "confidence": float(prediction.score.value),
                }
            )
        return holds


# Loaded once at import time so the model stays warm across requests.
detector = HoldDetector()
