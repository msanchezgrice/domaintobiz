import { logger } from '../utils/logger.js';
import { createProgressTracker, getProgressTracker } from '../utils/ProgressTracker.js';
import fs from 'fs/promises';
import path from 'path';

export function setupRoutes(app, services) {
  const { domainAnalyzer, strategyEngine, agentOrchestrator } = services;

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Analyze domains with real-time updates
  app.post('/api/analyze', async (req, res) => {
    try {
      const { domains, trackProgress } = req.body;
      
      if (!domains || !Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ 
          error: 'Please provide an array of domains to analyze' 
        });
      }

      logger.info(`Received request to analyze ${domains.length} domains`);
      
      // If progress tracking is requested, create a tracker
      let tracker = null;
      if (trackProgress) {
        const sessionId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        tracker = createProgressTracker(sessionId);
        
        // Return the session ID immediately so client can start listening
        res.json({
          success: true,
          sessionId,
          message: 'Analysis started',
          progressUrl: `/api/analysis-progress/${sessionId}`
        });
        
        // Run analysis asynchronously
        domainAnalyzer.analyzeDomains(domains, tracker).then(analysis => {
          tracker.complete({ analysis });
        }).catch(error => {
          tracker.addError(error, 'analysis');
          tracker.updateProgress({ status: 'failed' });
        });
        
        return;
      }
      
      // Standard synchronous analysis
      const analysis = await domainAnalyzer.analyzeDomains(domains);
      
      res.json({
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Analysis failed:', error);
      res.status(500).json({ 
        error: 'Analysis failed', 
        message: error.message 
      });
    }
  });
  
  // Analysis progress tracking endpoint
  app.get('/api/analysis-progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const tracker = getProgressTracker(sessionId);
    
    if (!tracker) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    tracker.addClient(res);
    
    req.on('close', () => {
      tracker.removeClient(res);
    });
  });

  // Generate business strategy
  app.post('/api/strategy', async (req, res) => {
    try {
      const { domainAnalysis } = req.body;
      
      if (!domainAnalysis) {
        return res.status(400).json({ 
          error: 'Please provide domain analysis data' 
        });
      }

      logger.info(`Generating strategy for ${domainAnalysis.domain}`);
      
      const strategy = await strategyEngine.generateStrategy(domainAnalysis);
      
      res.json({
        success: true,
        data: strategy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Strategy generation failed:', error);
      res.status(500).json({ 
        error: 'Strategy generation failed', 
        message: error.message 
      });
    }
  });

  // Execute full pipeline with progress tracking
  app.post('/api/execute', async (req, res) => {
    try {
      const { domains } = req.body;
      
      if (!domains || !Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ 
          error: 'Please provide an array of domains' 
        });
      }

      const sessionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tracker = createProgressTracker(sessionId);
      
      logger.info(`Executing full pipeline for ${domains.length} domains [${sessionId}]`);
      
      // Start async execution
      executeWithProgress(domains, tracker, { domainAnalyzer, strategyEngine, agentOrchestrator });
      
      res.json({
        success: true,
        message: 'Execution started',
        sessionId,
        progressUrl: `/api/progress/${sessionId}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Execution failed:', error);
      res.status(500).json({ 
        error: 'Execution failed', 
        message: error.message 
      });
    }
  });

  // Progress tracking endpoint
  app.get('/api/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const tracker = getProgressTracker(sessionId);
    
    if (!tracker) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    tracker.addClient(res);
    
    req.on('close', () => {
      tracker.removeClient(res);
    });
  });

  // Get execution status
  app.get('/api/status/:executionId', async (req, res) => {
    try {
      const { executionId } = req.params;
      
      const status = await agentOrchestrator.getExecutionStatus(executionId);
      
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Status check failed:', error);
      res.status(500).json({ 
        error: 'Status check failed', 
        message: error.message 
      });
    }
  });

  // Serve landing page as home
  app.get('/', (req, res) => {
    res.sendFile('landing.html', { root: 'public' });
  });
  
  // Serve analyzer app
  app.get('/app', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });
  
  // Serve agent dashboard
  app.get('/agents.html', (req, res) => {
    res.sendFile('agents.html', { root: 'public' });
  });
  
  // Serve projects dashboard
  app.get('/projects.html', (req, res) => {
    res.sendFile('projects.html', { root: 'public' });
  });
  
  // List deployed sites
  app.get('/api/deployed', async (req, res) => {
    try {
      const deploymentsPath = 'deployments';
      const deployments = [];
      
      try {
        const entries = await fs.readdir(deploymentsPath);
        for (const entry of entries) {
          const entryPath = path.join(deploymentsPath, entry);
          const stat = await fs.stat(entryPath);
          
          if (stat.isDirectory()) {
            // Try to find the port from server.js
            try {
              const serverPath = path.join(entryPath, 'server.js');
              const serverContent = await fs.readFile(serverPath, 'utf-8');
              const portMatch = serverContent.match(/const PORT = (\d+);/);
              const port = portMatch ? portMatch[1] : 'unknown';
              
              deployments.push({
                domain: entry,
                path: entryPath,
                url: `http://localhost:${port}`,
                port: port
              });
            } catch (e) {
              // Skip if no server.js found
            }
          }
        }
      } catch (e) {
        // No deployments folder yet
      }
      
      res.json({
        success: true,
        deployments,
        count: deployments.length
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list deployments' });
    }
  });
}

async function executeWithProgress(domains, tracker, services) {
  const { domainAnalyzer, strategyEngine, agentOrchestrator } = services;
  
  try {
    tracker.updateProgress({
      totalSteps: 4,
      status: 'in_progress'
    });
    
    // Step 1: Domain Analysis
    tracker.startStep('domain_analysis', {
      description: 'Analyzing domains for availability, content, and potential',
      domains
    });
    
    tracker.addThinking('Starting domain analysis phase', {
      domainsCount: domains.length,
      strategy: 'Will check WHOIS, DNS, crawl existing content, and score each domain'
    });
    
    const analysis = await domainAnalyzer.analyzeDomains(domains, tracker);
    
    tracker.completeStep('domain_analysis', {
      analyzed: analysis.analyzed.length,
      bestDomain: analysis.bestDomain?.domain,
      bestScore: analysis.bestDomain?.score
    });
    
    // Step 2: Validate Best Domain
    const bestDomain = analysis.bestDomain;
    
    if (!bestDomain || bestDomain.error) {
      tracker.addError('No suitable domain found in analysis', 'domain_validation');
      tracker.updateProgress({ status: 'failed' });
      return;
    }
    
    tracker.addThinking('Selected best domain for business creation', {
      domain: bestDomain.domain,
      score: bestDomain.score,
      reasoning: bestDomain.crawlData?.hasWebsite 
        ? 'Domain has existing content that can be analyzed and improved'
        : 'Domain is available for new business creation',
      breakdown: bestDomain.breakdown
    });
    
    // Step 3: Business Strategy Generation
    tracker.startStep('strategy_generation', {
      description: 'AI is analyzing domain and creating comprehensive business strategy',
      domain: bestDomain.domain
    });
    
    tracker.addThinking('Generating business strategy using reasoning models', {
      approach: 'Using Claude and GPT-4 to analyze domain characteristics and market potential',
      factors: ['domain name implications', 'existing content analysis', 'market positioning', 'business model viability']
    });
    
    const strategy = await strategyEngine.generateStrategy(bestDomain, tracker);
    
    tracker.completeStep('strategy_generation', {
      businessType: strategy.businessModel?.type,
      revenueModel: strategy.businessModel?.revenueModel,
      brandPosition: strategy.brandStrategy?.positioning
    });
    
    // Step 4: Website Creation
    tracker.startStep('website_creation', {
      description: 'AI agents are collaboratively building your website',
      domain: bestDomain.domain
    });
    
    tracker.addThinking('Starting AI agent orchestration for website creation', {
      agents: ['Design Agent', 'Content Agent', 'Development Agent', 'Deployment Agent'],
      approach: 'Parallel execution with dependency management'
    });
    
    const result = await agentOrchestrator.executePlan(strategy, tracker);
    
    tracker.completeStep('website_creation', {
      websiteUrl: result.websiteUrl,
      files: Object.keys(result.results.development.files || {}).length
    });
    
    // Completion
    tracker.complete({
      domain: bestDomain.domain,
      websiteUrl: result.websiteUrl,
      strategy: strategy,
      executionId: result.executionId
    });
    
    logger.info(`Execution completed successfully for ${bestDomain.domain}: ${result.websiteUrl}`);
    
  } catch (error) {
    logger.error('Execution failed:', error);
    tracker.addError(error, tracker.progress.currentStep);
    tracker.updateProgress({ status: 'failed' });
  }
}