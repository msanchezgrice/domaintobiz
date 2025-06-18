export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req;
    const executionId = query.executionId || query[0]; // Handle dynamic route

    if (!executionId || executionId === 'undefined') {
      return res.status(400).json({ 
        error: 'Missing execution ID' 
      });
    }

    // Simple progress simulation
    res.write(`data: ${JSON.stringify({
      step: 'Analysis Complete',
      progress: 100,
      message: 'Domain analysis completed successfully',
      timestamp: new Date().toISOString(),
      executionId
    })}\n\n`);

    res.write(`data: ${JSON.stringify({
      step: 'Complete',
      progress: 100,
      message: 'All steps completed',
      timestamp: new Date().toISOString(),
      executionId,
      completed: true
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('Progress endpoint error:', error);
    return res.status(500).json({ 
      error: 'Progress tracking failed', 
      message: error.message
    });
  }
}