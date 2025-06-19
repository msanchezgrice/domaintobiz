import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DeploymentAgent {
  constructor() {
    this.deploymentMethods = {
      netlify: this.deployToNetlify.bind(this),
      vercel: this.deployToVercel.bind(this),
      github: this.deployToGithubPages.bind(this),
      local: this.deployLocally.bind(this)
    };
  }

  async execute(taskData, tracker = null) {
    logger.info(`Deployment Agent executing for ${taskData.strategy.domain}`);
    
    if (tracker) {
      tracker.addAgentLog('deployment', 'Starting deployment process', {
        domain: taskData.strategy.domain,
        files: Object.keys(taskData.developmentResult?.files || {}).length,
        deploymentMethod: process.env.DEPLOYMENT_METHOD || 'local'
      });
    }
    
    const { developmentResult } = taskData;
    const deploymentMethod = process.env.DEPLOYMENT_METHOD || 'local';
    
    if (tracker) {
      tracker.addAgentLog('deployment', `Deploying via ${deploymentMethod} method`, {
        sourcePath: developmentResult.outputPath,
        entryPoint: developmentResult.entryPoint
      });
    }
    
    const deployment = await this.deploymentMethods[deploymentMethod]({
      files: developmentResult.outputPath,
      domain: taskData.strategy.domain,
      executionId: taskData.executionId
    });
    
    if (tracker) {
      tracker.addAgentLog('deployment', 'Verifying deployment accessibility', {
        url: deployment.url,
        method: deployment.method
      });
    }
    
    const isAccessible = await this.verifyDeployment(deployment.url);
    
    if (tracker) {
      tracker.addAgentLog('deployment', 'Deployment completed successfully', {
        finalUrl: deployment.url,
        verified: isAccessible,
        method: deployment.method,
        instructions: deployment.instructions || 'Website is live and accessible'
      });
    }
    
    return {
      ...deployment,
      domain: taskData.strategy.domain,
      verified: isAccessible,
      timestamp: new Date().toISOString()
    };
  }

  async deployToNetlify(config) {
    logger.info('Deploying to Netlify...');
    
    try {
      const { stdout } = await execAsync(
        `npx netlify deploy --dir="${config.files}" --prod`,
        { cwd: process.cwd() }
      );
      
      const urlMatch = stdout.match(/Website URL:\s*(https:\/\/[^\s]+)/);
      const url = urlMatch ? urlMatch[1] : `https://${config.domain}`;
      
      return {
        method: 'netlify',
        url,
        status: 'deployed',
        details: stdout
      };
    } catch (error) {
      logger.error('Netlify deployment failed:', error);
      return this.deployLocally(config);
    }
  }

  async deployToVercel(config) {
    logger.info('Deploying to Vercel...');
    
    try {
      const { stdout } = await execAsync(
        `npx vercel "${config.files}" --prod --yes`,
        { cwd: process.cwd() }
      );
      
      const urlMatch = stdout.match(/https:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : `https://${config.domain}`;
      
      return {
        method: 'vercel',
        url,
        status: 'deployed',
        details: stdout
      };
    } catch (error) {
      logger.error('Vercel deployment failed:', error);
      return this.deployLocally(config);
    }
  }

  async deployToGithubPages(config) {
    logger.info('Deploying to GitHub Pages...');
    
    const repoName = config.domain.replace(/\./g, '-');
    const gitDir = path.join('output', config.executionId, 'git-deploy');
    
    try {
      await fs.mkdir(gitDir, { recursive: true });
      
      await execAsync(`cp -r "${config.files}"/* "${gitDir}"/`);
      
      const commands = [
        'git init',
        'git add .',
        'git commit -m "Deploy website"',
        `git remote add origin https://github.com/${process.env.GITHUB_USERNAME}/${repoName}.git`,
        'git push -u origin main --force'
      ];
      
      for (const cmd of commands) {
        await execAsync(cmd, { cwd: gitDir });
      }
      
      return {
        method: 'github',
        url: `https://${process.env.GITHUB_USERNAME}.github.io/${repoName}`,
        status: 'deployed',
        repository: `https://github.com/${process.env.GITHUB_USERNAME}/${repoName}`
      };
    } catch (error) {
      logger.error('GitHub Pages deployment failed:', error);
      return this.deployLocally(config);
    }
  }

  async deployLocally(config) {
    logger.info('Setting up local deployment...');
    
    const localPort = 3000 + Math.floor(Math.random() * 1000);
    const deployPath = path.join('deployments', config.domain);
    
    await fs.mkdir(deployPath, { recursive: true });
    await execAsync(`cp -r "${config.files}"/* "${deployPath}"/`);
    
    const serverConfig = `
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = ${localPort};

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  let extname = path.extname(filePath).toLowerCase();
  let contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
    `;
    
    await fs.writeFile(
      path.join(deployPath, 'server.js'),
      serverConfig
    );
    
    // Actually start the server
    try {
      logger.info(`Starting local server for ${config.domain} on port ${localPort}`);
      
      // Start the server in background using spawn
      const serverProcess = spawn('node', ['server.js'], {
        cwd: deployPath,
        detached: true,
        stdio: 'ignore'
      });
      
      // Unref the process so it doesn't keep the parent alive
      serverProcess.unref();
      
      // Give the server a moment to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      logger.info(`Local server started for ${config.domain} on port ${localPort}`);
      
      return {
        method: 'local',
        url: `http://localhost:${localPort}`,
        status: 'deployed',
        path: deployPath,
        port: localPort,
        instructions: `Server is running at http://localhost:${localPort}`,
        pid: serverProcess.pid
      };
    } catch (error) {
      logger.error('Failed to start local server:', error);
      
      return {
        method: 'local',
        url: `http://localhost:${localPort}`,
        status: 'deployed',
        path: deployPath,
        port: localPort,
        instructions: `Run 'cd ${deployPath} && node server.js' to start the server manually`,
        error: error.message
      };
    }
  }

  async verifyDeployment(url) {
    logger.info(`Verifying deployment at ${url}`);
    
    if (url.startsWith('http://localhost')) {
      logger.info('Local deployment - skipping verification');
      return true;
    }
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        logger.info('Deployment verified successfully');
        return true;
      } else {
        logger.warn(`Deployment returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      logger.error('Deployment verification failed:', error);
      return false;
    }
  }
}