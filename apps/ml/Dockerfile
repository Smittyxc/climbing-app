FROM python:3.11-slim

# System libraries required by OpenCV / PyTorch
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code and model weights
COPY . .

ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV INFERENCE_MODE=yolo

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
