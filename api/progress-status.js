// In-memory storage for progress (in production, use Redis or database)
const progressStore = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  if (req.method === 'GET') {
    // Check if this is an EventSource request
    const acceptHeader = req.headers.accept;
    if (acceptHeader && acceptHeader.includes('text/event-stream')) {
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial progress state
      const progress = progressStore.get(sessionId) || {
        sessionId,
        status: 'waiting',
        domain: 'Loading...',
        agents: {
          design: { status: 'waiting', message: 'Waiting' },
          content: { status: 'waiting', message: 'Waiting' },
          development: { status: 'waiting', message: 'Waiting' },
          deployment: { status: 'waiting', message: 'Waiting' }
        },
        completedSteps: 0,
        totalSteps: 4
      };

      res.write(`data: ${JSON.stringify(progress)}\n\n`);

      // Set up polling for updates
      const pollInterval = setInterval(() => {
        const currentProgress = progressStore.get(sessionId);
        if (currentProgress) {
          res.write(`data: ${JSON.stringify(currentProgress)}\n\n`);
          
          // Close connection if completed
          if (currentProgress.status === 'completed' || currentProgress.status === 'error') {
            clearInterval(pollInterval);
            res.end();
          }
        }
      }, 1000);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(pollInterval);
      });

      return;
    }

    // Regular JSON response for non-SSE requests
    const progress = progressStore.get(sessionId) || {
      sessionId,
      status: 'waiting',
      domain: 'Loading...',
      agents: {
        design: { status: 'waiting', message: 'Waiting' },
        content: { status: 'waiting', message: 'Waiting' },
        development: { status: 'waiting', message: 'Waiting' },
        deployment: { status: 'waiting', message: 'Waiting' }
      },
      completedSteps: 0,
      totalSteps: 4
    };

    return res.status(200).json(progress);
  }

  if (req.method === 'POST') {
    // Update progress
    const updates = req.body;
    const existing = progressStore.get(sessionId) || {};
    
    const updated = {
      ...existing,
      ...updates,
      sessionId,
      lastUpdate: new Date().toISOString()
    };
    
    progressStore.set(sessionId, updated);
    
    // Clean up old sessions after 1 hour
    setTimeout(() => {
      progressStore.delete(sessionId);
    }, 3600000);

    return res.status(200).json({ success: true, data: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}