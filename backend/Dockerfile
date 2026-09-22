FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for NLP compilation
RUN apt-get update && apt-get install -y build-essential

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
# Pre-download spaCy model during build
RUN python -m spacy download en_core_web_sm

COPY . .

EXPOSE 8000
CMD ["python", "-m", "flask", "--app", "main", "run", "--host", "0.0.0.0", "--port", "8000"]
