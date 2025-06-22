FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Set work directory
WORKDIR /app

# Install system dependencies including DNS tools
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    dnsutils \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt /app/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app/

# Make scripts executable
RUN chmod +x poller.py dns_test.py entrypoint.sh dns_resolver.py supabase_http.py

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash worker
RUN chown -R worker:worker /app

# Use entrypoint script (runs as root for DNS config, then switches to worker user)
ENTRYPOINT ["./entrypoint.sh"] 