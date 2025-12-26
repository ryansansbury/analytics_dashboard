FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Expose port
EXPOSE $PORT

# Start the app
CMD gunicorn run:app --bind 0.0.0.0:$PORT --workers 2
