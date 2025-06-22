#!/usr/bin/env python3
"""
DNS resolver utility to handle IPv4/IPv6 compatibility issues
"""

import socket
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

def resolve_hostname_to_ipv4(hostname: str) -> Optional[str]:
    """
    Resolve hostname to IPv4 address using multiple methods
    """
    try:
        # Method 1: Try socket.getaddrinfo with IPv4 preference
        logger.info(f"🔍 Resolving {hostname} to IPv4...")
        
        # Get all addresses and prefer IPv4
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_INET)
        if addr_info:
            ipv4 = addr_info[0][4][0]
            logger.info(f"✅ Resolved {hostname} -> {ipv4}")
            return ipv4
            
    except socket.gaierror as e:
        logger.warning(f"⚠️ Standard resolution failed: {e}")
    
    try:
        # Method 2: Try using Google DNS directly
        logger.info(f"🔍 Trying Google DNS for {hostname}...")
        
        # Use DNS over HTTPS (DoH) as fallback
        response = httpx.get(
            f"https://dns.google/resolve",
            params={"name": hostname, "type": "A"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "Answer" in data and len(data["Answer"]) > 0:
                ipv4 = data["Answer"][0]["data"]
                logger.info(f"✅ Google DNS resolved {hostname} -> {ipv4}")
                return ipv4
                
    except Exception as e:
        logger.warning(f"⚠️ Google DNS failed: {e}")
    
    try:
        # Method 3: Try Cloudflare DNS
        logger.info(f"🔍 Trying Cloudflare DNS for {hostname}...")
        
        response = httpx.get(
            f"https://cloudflare-dns.com/dns-query",
            params={"name": hostname, "type": "A"},
            headers={"Accept": "application/dns-json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "Answer" in data and len(data["Answer"]) > 0:
                ipv4 = data["Answer"][0]["data"]
                logger.info(f"✅ Cloudflare DNS resolved {hostname} -> {ipv4}")
                return ipv4
                
    except Exception as e:
        logger.warning(f"⚠️ Cloudflare DNS failed: {e}")
    
    logger.error(f"❌ All DNS resolution methods failed for {hostname}")
    return None

def get_supabase_ip(supabase_url: str) -> Optional[str]:
    """
    Extract hostname from Supabase URL and resolve to IP
    """
    try:
        from urllib.parse import urlparse
        parsed = urlparse(supabase_url)
        hostname = parsed.hostname
        
        if hostname:
            return resolve_hostname_to_ipv4(hostname)
        
    except Exception as e:
        logger.error(f"❌ Failed to parse Supabase URL: {e}")
    
    return None

def create_ip_based_url(original_url: str, ip_address: str) -> str:
    """
    Replace hostname in URL with IP address
    """
    try:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(original_url)
        
        # Replace hostname with IP, keep everything else
        new_netloc = f"{ip_address}"
        if parsed.port:
            new_netloc += f":{parsed.port}"
            
        new_parsed = parsed._replace(netloc=new_netloc)
        return urlunparse(new_parsed)
        
    except Exception as e:
        logger.error(f"❌ Failed to create IP-based URL: {e}")
        return original_url 