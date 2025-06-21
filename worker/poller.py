#!/usr/bin/env python3
"""
Simple poller script that runs the site generation worker continuously
This is the main entry point for the containerized worker
"""

import asyncio
import signal
import sys
from main import SiteGenerationWorker

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"\n🛑 Received signal {signum}, shutting down...")
    sys.exit(0)

async def run_worker():
    """Run the worker with error recovery"""
    worker = SiteGenerationWorker()
    
    while True:
        try:
            print("🚀 Starting site generation worker...")
            await worker.poll_queue()
        except KeyboardInterrupt:
            print("👋 Received shutdown signal")
            break
        except Exception as e:
            print(f"❌ Worker crashed: {e}")
            print("🔄 Restarting worker in 10 seconds...")
            await asyncio.sleep(10)
        finally:
            await worker.shutdown()

def main():
    """Main entry point"""
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("🤖 DomainToBiz Site Generation Worker Starting...")
    print("📋 Press Ctrl+C to stop")
    
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        print("\n👋 Worker stopped")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 