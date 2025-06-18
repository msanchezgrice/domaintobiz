import express from 'express';
import dotenv from 'dotenv';
import { DomainAnalyzer } from './analyzers/DomainAnalyzer.js';
import { BusinessStrategyEngine } from './models/BusinessStrategyEngine.js';
import { AgentOrchestrator } from './agents/AgentOrchestrator.js';
import { setupRoutes } from './api/routes.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('public'));

const domainAnalyzer = new DomainAnalyzer();
const strategyEngine = new BusinessStrategyEngine();
const agentOrchestrator = new AgentOrchestrator();

setupRoutes(app, { domainAnalyzer, strategyEngine, agentOrchestrator });

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Domain Analyzer API running on port ${PORT}`);
  console.log(`Server accessible at http://localhost:${PORT}`);
  console.log(`Also try: http://192.168.6.70:${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});