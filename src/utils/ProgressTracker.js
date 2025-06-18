import { logger } from './logger.js';

export class ProgressTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.progress = {
      sessionId,
      currentStep: 'initializing',
      totalSteps: 0,
      completedSteps: 0,
      status: 'starting',
      details: [],
      errors: [],
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Send current state immediately
    this.sendToClient(res, this.progress);
  }

  removeClient(res) {
    this.clients.delete(res);
  }

  updateProgress(updates) {
    this.progress = {
      ...this.progress,
      ...updates,
      lastUpdate: new Date().toISOString()
    };
    
    logger.info(`Progress Update [${this.sessionId}]:`, updates);
    this.broadcast();
  }

  updateAgentStatus(agentName, status, message) {
    if (!this.progress.agents) {
      this.progress.agents = {};
    }
    
    this.progress.agents[agentName] = {
      ...this.progress.agents[agentName],
      status,
      message,
      lastUpdate: new Date().toISOString()
    };
    
    this.updateProgress({});
  }

  addAgentLog(agentName, message, context = {}) {
    if (!this.progress.agentLogs) {
      this.progress.agentLogs = {};
    }
    
    if (!this.progress.agentLogs[agentName]) {
      this.progress.agentLogs[agentName] = [];
    }
    
    this.progress.agentLogs[agentName].push({
      message,
      context,
      timestamp: new Date().toISOString()
    });
    
    this.updateProgress({});
  }

  startStep(stepName, stepDetails = {}) {
    this.updateProgress({
      currentStep: stepName,
      status: 'in_progress',
      details: [...this.progress.details, {
        step: stepName,
        status: 'started',
        timestamp: new Date().toISOString(),
        ...stepDetails
      }]
    });
  }

  completeStep(stepName, result = {}) {
    this.updateProgress({
      completedSteps: this.progress.completedSteps + 1,
      details: this.progress.details.map(detail => 
        detail.step === stepName 
          ? { ...detail, status: 'completed', result, completedAt: new Date().toISOString() }
          : detail
      )
    });
  }

  addThinking(thought, context = {}) {
    this.updateProgress({
      details: [...this.progress.details, {
        type: 'thinking',
        thought,
        context,
        timestamp: new Date().toISOString()
      }]
    });
  }

  addError(error, step = null) {
    const errorDetail = {
      error: error.message || error,
      step,
      timestamp: new Date().toISOString()
    };
    
    this.updateProgress({
      status: 'error',
      errors: [...this.progress.errors, errorDetail],
      details: [...this.progress.details, {
        type: 'error',
        ...errorDetail
      }]
    });
  }

  complete(result = {}) {
    this.updateProgress({
      status: 'completed',
      result,
      endTime: new Date().toISOString(),
      details: [...this.progress.details, {
        type: 'completion',
        result,
        timestamp: new Date().toISOString()
      }]
    });
  }

  sendToClient(res, data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      this.removeClient(res);
    }
  }

  broadcast() {
    this.clients.forEach(client => {
      this.sendToClient(client, this.progress);
    });
  }

  getProgress() {
    return this.progress;
  }
}

// Global progress tracker registry
const progressTrackers = new Map();

export function createProgressTracker(sessionId) {
  const tracker = new ProgressTracker(sessionId);
  progressTrackers.set(sessionId, tracker);
  return tracker;
}

export function getProgressTracker(sessionId) {
  return progressTrackers.get(sessionId);
}

export function removeProgressTracker(sessionId) {
  const tracker = progressTrackers.get(sessionId);
  if (tracker) {
    tracker.clients.forEach(client => {
      try {
        client.end();
      } catch (e) {
        // Client already closed
      }
    });
  }
  progressTrackers.delete(sessionId);
}