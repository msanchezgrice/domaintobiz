#!/usr/bin/env python3
"""
HTTP-based Supabase client to bypass DNS resolution issues
"""

import os
import json
import httpx
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class SupabaseHTTPClient:
    def __init__(self, url: str, service_role_key: str):
        self.url = url.rstrip('/')
        self.service_role_key = service_role_key
        self.headers = {
            'apikey': service_role_key,
            'Authorization': f'Bearer {service_role_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> httpx.Response:
        """Make HTTP request with custom DNS resolution if needed"""
        url = f"{self.url}{endpoint}"
        
        # Try with custom DNS resolution using Google DNS
        client_kwargs = {
            'timeout': 30,
            'headers': self.headers,
        }
        
        try:
            # First try with default resolution
            with httpx.Client(**client_kwargs) as client:
                return client.request(method, url, **kwargs)
        except Exception as e:
            logger.warning(f"Standard request failed: {e}, trying with IP resolution...")
            
            # Try with IP-based URL
            try:
                from dns_resolver import get_supabase_ip, create_ip_based_url
                
                ip = get_supabase_ip(self.url)
                if ip:
                    ip_url = create_ip_based_url(url, ip)
                    logger.info(f"🔄 Retrying with IP-based URL: {ip_url}")
                    
                    # Add Host header to maintain SSL certificate validation
                    from urllib.parse import urlparse
                    original_host = urlparse(self.url).hostname
                    headers_with_host = {**self.headers, 'Host': original_host}
                    
                    with httpx.Client(timeout=30, headers=headers_with_host, verify=False) as client:
                        return client.request(method, ip_url, **kwargs)
                else:
                    logger.error("❌ Could not resolve IP address")
                    
            except Exception as e2:
                logger.error(f"❌ IP resolution also failed: {e2}")
            
            # If all fails, raise the original exception
            raise e
    
    def table(self, table_name: str):
        """Return a table interface"""
        return SupabaseTable(self, table_name)
    
    def rpc(self, function_name: str, params: Dict = None):
        """Call a stored procedure"""
        endpoint = f"/rest/v1/rpc/{function_name}"
        try:
            response = self._make_request('POST', endpoint, json=params or {})
            response.raise_for_status()
            return SupabaseResponse(response.json())
        except Exception as e:
            logger.error(f"RPC call {function_name} failed: {e}")
            raise

class SupabaseTable:
    def __init__(self, client: SupabaseHTTPClient, table_name: str):
        self.client = client
        self.table_name = table_name
        self._select_fields = '*'
        self._filters = []
        self._order = None
        self._limit_val = None
    
    def select(self, fields: str = '*'):
        """Select fields"""
        self._select_fields = fields
        return self
    
    def eq(self, column: str, value: Any):
        """Add equality filter"""
        self._filters.append(f"{column}=eq.{value}")
        return self
    
    def order(self, column: str, desc: bool = False):
        """Add ordering"""
        direction = 'desc' if desc else 'asc'
        self._order = f"{column}.{direction}"
        return self
    
    def limit(self, count: int):
        """Add limit"""
        self._limit_val = count
        return self
    
    def execute(self):
        """Execute the query"""
        endpoint = f"/rest/v1/{self.table_name}"
        params = {'select': self._select_fields}
        
        # Add filters
        for filter_str in self._filters:
            key, value = filter_str.split('=', 1)
            params[key] = value
        
        # Add ordering
        if self._order:
            params['order'] = self._order
        
        # Add limit
        if self._limit_val:
            params['limit'] = str(self._limit_val)
        
        try:
            response = self.client._make_request('GET', endpoint, params=params)
            response.raise_for_status()
            return SupabaseResponse(response.json())
        except Exception as e:
            logger.error(f"Table query failed: {e}")
            raise
    
    def insert(self, data: Dict):
        """Insert data"""
        endpoint = f"/rest/v1/{self.table_name}"
        try:
            response = self.client._make_request('POST', endpoint, json=data)
            response.raise_for_status()
            return SupabaseResponse(response.json())
        except Exception as e:
            logger.error(f"Insert failed: {e}")
            raise
    
    def update(self, data: Dict):
        """Update data (returns self for chaining)"""
        self._update_data = data
        return self
    
    def execute_update(self):
        """Execute update with filters"""
        endpoint = f"/rest/v1/{self.table_name}"
        params = {}
        
        # Add filters to query params
        for filter_str in self._filters:
            key, value = filter_str.split('=', 1)
            params[key] = value
        
        try:
            response = self.client._make_request('PATCH', endpoint, 
                                                json=self._update_data, 
                                                params=params)
            response.raise_for_status()
            return SupabaseResponse(response.json())
        except Exception as e:
            logger.error(f"Update failed: {e}")
            raise

class SupabaseResponse:
    def __init__(self, data):
        self.data = data if isinstance(data, list) else [data] if data else []

def create_http_client(url: str, service_role_key: str) -> SupabaseHTTPClient:
    """Create HTTP-based Supabase client"""
    return SupabaseHTTPClient(url, service_role_key) 