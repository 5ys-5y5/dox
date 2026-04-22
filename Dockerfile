FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
python3 \
python3-venv \
python3-pip \
tesseract-ocr \
tesseract-ocr-eng \
tesseract-ocr-kor \
libglib2.0-0 \
libgomp1 \
libgl1 \
&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY requirements.txt ./
RUN python3 -m venv /opt/template-extract-python \
&& /opt/template-extract-python/bin/pip install --upgrade pip setuptools wheel \
&& /opt/template-extract-python/bin/pip install -r requirements.txt

COPY . .

ENV TEMPLATE_EXTRACT_PYTHON_BIN=/opt/template-extract-python/bin/python3
ENV TEMPLATE_EXTRACT_RASTER_FIRST_OCR_LANG=kor+eng
ENV NODE_ENV=production

RUN npm run build

CMD ["sh", "-c", "npm run start -- -p ${PORT:-3000}"]
