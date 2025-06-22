// Auto-trigger queue processing when users are on the site
// This provides a backup to the GitHub Actions cron job

class QueueAutoTrigger {
  constructor() {
    this.isActive = false;
    this.intervalId = null;
    this.triggerInterval = 90000; // 90 seconds
    this.lastTrigger = 0;
    this.minInterval = 60000; // Minimum 60 seconds between triggers
  }

  start() {
    if (this.isActive) return;
    
    console.log('🚀 Starting queue auto-trigger...');
    this.isActive = true;
    
    // Initial trigger after 10 seconds
    setTimeout(() => this.triggerQueue(), 10000);
    
    // Regular interval
    this.intervalId = setInterval(() => this.triggerQueue(), this.triggerInterval);
    
    // Also trigger when page becomes visible (user returns to tab)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - this.lastTrigger > this.minInterval) {
        this.triggerQueue();
      }
    });
  }

  stop() {
    if (!this.isActive) return;
    
    console.log('⏹️ Stopping queue auto-trigger...');
    this.isActive = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async triggerQueue() {
    if (Date.now() - this.lastTrigger < this.minInterval) {
      console.log('⏱️ Skipping trigger (too soon)');
      return;
    }

    try {
      console.log('🔄 Auto-triggering queue processor...');
      this.lastTrigger = Date.now();

      const response = await fetch('/api/queue/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trigger: 'client_auto',
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.processed > 0) {
          console.log(`✅ Queue trigger successful: ${result.processed} jobs processed`);
          
          // Show subtle notification if jobs were processed
          this.showNotification(`${result.processed} website(s) are being built...`);
        } else {
          console.log('📋 Queue trigger successful: no pending jobs');
        }
      } else {
        console.warn('⚠️ Queue trigger failed:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Queue trigger error:', error.message);
    }
  }

  showNotification(message) {
    // Only show if user is actively on the page
    if (document.hidden) return;

    // Simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Remove after 4 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
  }
}

// Initialize and start auto-trigger
const queueTrigger = new QueueAutoTrigger();

// Start when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => queueTrigger.start());
} else {
  queueTrigger.start();
}

// Stop when page unloads
window.addEventListener('beforeunload', () => queueTrigger.stop());

// Export for debugging
window.queueTrigger = queueTrigger; 