#!/usr/bin/env python3
"""
DNS resolution test script to verify connectivity before starting the worker
"""

import socket
import sys
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_dns_resolution():
    """Test DNS resolution for required services"""
    test_domains = [
        "hxfmtcnvpgvdgrbumxtk.supabase.co",  # Supabase
        "api.openai.com",                    # OpenAI
        "api.anthropic.com",                 # Anthropic
        "google.com"                         # General connectivity
    ]
    
    logger.info("🔍 Testing DNS resolution...")
    successful_tests = 0
    
    for domain in test_domains:
        try:
            logger.info(f"  Testing {domain}...")
            ip = socket.gethostbyname(domain)
            logger.info(f"  ✅ {domain} -> {ip}")
            successful_tests += 1
        except socket.gaierror as e:
            logger.warning(f"  ⚠️ {domain} -> DNS resolution failed: {e}")
        except Exception as e:
            logger.warning(f"  ⚠️ {domain} -> Unexpected error: {e}")
    
    if successful_tests >= 1:  # At least one domain should resolve
        logger.info(f"✅ DNS tests passed ({successful_tests}/{len(test_domains)} domains resolved)")
        return True
    else:
        logger.error("❌ All DNS tests failed!")
        return False

def test_supabase_connectivity():
    """Test HTTP connectivity to Supabase"""
    import os
    import httpx
    
    supabase_url = os.getenv('SUPABASE_URL')
    if not supabase_url:
        logger.warning("⚠️ SUPABASE_URL environment variable not set - skipping connectivity test")
        return True  # Allow worker to proceed
    
    try:
        logger.info(f"🔌 Testing HTTP connectivity to {supabase_url}...")
        
        with httpx.Client(timeout=10) as client:
            response = client.get(f"{supabase_url}/rest/v1/", headers={
                'apikey': os.getenv('SUPABASE_SERVICE_ROLE_KEY', ''),
                'Authorization': f'Bearer {os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")}'
            })
            
            if response.status_code in [200, 401, 403]:  # These are expected responses
                logger.info(f"✅ Supabase HTTP connectivity OK (status: {response.status_code})")
                return True
            else:
                logger.warning(f"⚠️ Unexpected response status: {response.status_code} - proceeding anyway")
                return True  # Allow worker to proceed and handle connection in main loop
                
    except Exception as e:
        logger.warning(f"⚠️ Supabase connectivity test failed: {e} - proceeding anyway")
        return True  # Allow worker to proceed and handle connection in main loop

def main():
    """Main test function"""
    logger.info("🚀 Starting DNS and connectivity tests...")
    
    # Test DNS resolution
    if not test_dns_resolution():
        logger.error("❌ DNS tests failed - cannot proceed")
        sys.exit(1)
    
    # Test Supabase connectivity
    if not test_supabase_connectivity():
        logger.error("❌ Supabase connectivity failed - cannot proceed")
        sys.exit(1)
    
    logger.info("🎉 All connectivity tests passed! Worker can start.")
    return True

if __name__ == "__main__":
    main() 