#!/bin/bash

echo "🚀 DomainToBiz Worker Entrypoint Starting..."

# Try to fix DNS by using public DNS servers
echo "🔧 Configuring DNS..."
if [ -w /etc/resolv.conf ]; then
    echo "nameserver 8.8.8.8" > /etc/resolv.conf
    echo "nameserver 8.8.4.4" >> /etc/resolv.conf
    echo "nameserver 1.1.1.1" >> /etc/resolv.conf
    echo "✅ DNS configured successfully"
else
    echo "⚠️  Cannot modify /etc/resolv.conf, using system DNS"
fi

# Test DNS resolution
echo "🔍 Testing DNS resolution..."
nslookup google.com || echo "⚠️  DNS test failed, continuing anyway..."

# Start the Python worker
echo "🤖 Starting Python worker..."
exec python poller.py 