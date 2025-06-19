import { DesignAgent } from './DesignAgent.js';
import { ContentAgent } from './ContentAgent.js';
import { DevelopmentAgent } from './DevelopmentAgent.js';
import { DeploymentAgent } from './DeploymentAgent.js';
import { logger } from '../utils/logger.js';
import Bull from 'bull';

export class AgentOrchestrator {
  constructor() {
    this.agents = {
      design: new DesignAgent(),
      content: new ContentAgent(),
      development: new DevelopmentAgent(),
      deployment: new DeploymentAgent()
    };
    
    this.taskQueue = new Bull('agent-tasks', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    this.setupQueueProcessing();
  }

  setupQueueProcessing() {
    this.taskQueue.process('design', async (job) => {
      return await this.agents.design.execute(job.data);
    });
    
    this.taskQueue.process('content', async (job) => {
      return await this.agents.content.execute(job.data);
    });
    
    this.taskQueue.process('development', async (job) => {
      return await this.agents.development.execute(job.data);
    });
    
    this.taskQueue.process('deployment', async (job) => {
      return await this.agents.deployment.execute(job.data);
    });
  }

  async executePlan(strategy, tracker = null) {
    logger.info(`Orchestrating implementation for ${strategy.domain}`);
    
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (tracker) {
      tracker.addThinking('Starting AI agent collaboration', {
        executionId,
        agentPlan: 'Design and Content agents will work in parallel, then Development agent will combine results, finally Deployment agent will publish'
      });
      
      // Initialize agent states
      tracker.updateProgress({
        agents: {
          design: { status: 'starting', progress: 0 },
          content: { status: 'starting', progress: 0 },
          development: { status: 'waiting', progress: 0 },
          deployment: { status: 'waiting', progress: 0 }
        }
      });
    }
    
    // Execute agents with individual tracking
    const results = {};
    
    try {
      // Design Agent
      if (tracker) {
        tracker.updateAgentStatus('design', 'running', 'Generating design system and wireframes');
      }
      
      results.design = await this.executeAgentWithTracking('design', {
        strategy,
        task: strategy.implementation.design || {}
      }, tracker);
      
      if (tracker) {
        tracker.updateAgentStatus('design', 'completed', 'Design system and wireframes created');
      }
      
      // Content Agent (parallel)
      if (tracker) {
        tracker.updateAgentStatus('content', 'running', 'Creating content and copy');
      }
      
      results.content = await this.executeAgentWithTracking('content', {
        strategy,
        task: strategy.implementation.content || {}
      }, tracker);
      
      if (tracker) {
        tracker.updateAgentStatus('content', 'completed', 'All content and copy generated');
      }
      
      // Development Agent
      if (tracker) {
        tracker.updateAgentStatus('development', 'running', 'Building website files');
      }
      
      results.development = await this.executeAgentWithTracking('development', {
        strategy,
        designResult: results.design,
        contentResult: results.content
      }, tracker);
      
      if (tracker) {
        tracker.updateAgentStatus('development', 'completed', 'Website files built successfully');
      }
      
      // Deployment Agent
      if (tracker) {
        tracker.updateAgentStatus('deployment', 'running', 'Deploying website');
      }
      
      results.deployment = await this.executeAgentWithTracking('deployment', {
        strategy,
        developmentResult: results.development
      }, tracker);
      
      if (tracker) {
        tracker.updateAgentStatus('deployment', 'completed', 'Website deployed successfully');
      }
      
    } catch (error) {
      logger.error('Agent execution failed:', error);
      if (tracker) {
        tracker.addError(error, 'agent_execution');
      }
      throw error;
    }
    
    const result = {
      executionId,
      domain: strategy.domain,
      status: 'completed',
      results,
      websiteUrl: results.deployment.url,
      timestamp: new Date().toISOString()
    };
    
    if (tracker) {
      tracker.addThinking('All agents completed successfully', {
        finalUrl: results.deployment.url,
        deploymentMethod: results.deployment.method,
        totalFiles: Object.keys(results.development.files || {}).length
      });
    }
    
    return result;
  }
  
  async executeAgentWithTracking(agentName, taskData, tracker) {
    const agent = this.agents[agentName];
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }
    
    try {
      if (tracker) {
        tracker.addAgentLog(agentName, 'Starting agent execution', { taskData: Object.keys(taskData) });
      }
      
      const result = await agent.execute(taskData, tracker);
      
      if (tracker) {
        tracker.addAgentLog(agentName, 'Agent execution completed', { 
          resultKeys: Object.keys(result),
          outputSize: JSON.stringify(result).length 
        });
      }
      
      return result;
      
    } catch (error) {
      if (tracker) {
        tracker.addAgentLog(agentName, `Agent failed: ${error.message}`, { error: error.stack });
        tracker.updateAgentStatus(agentName, 'error', error.message);
      }
      throw error;
    }
  }

  async waitForTask(task) {
    return new Promise((resolve, reject) => {
      task.finished().then(resolve).catch(reject);
    });
  }

  async getExecutionStatus(executionId) {
    const jobs = await this.taskQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const executionJobs = jobs.filter(job => job.data.executionId === executionId);
    
    const status = {
      executionId,
      totalTasks: executionJobs.length,
      completed: executionJobs.filter(job => job.finishedOn).length,
      failed: executionJobs.filter(job => job.failedReason).length,
      inProgress: executionJobs.filter(job => !job.finishedOn && !job.failedReason).length,
      tasks: executionJobs.map(job => ({
        name: job.name,
        status: job.finishedOn ? 'completed' : job.failedReason ? 'failed' : 'in_progress',
        result: job.returnvalue,
        error: job.failedReason
      }))
    };
    
    return status;
  }
}