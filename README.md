# Domain Analyzer - AI-Powered Business Generator

🚀 **Transform any domain into a thriving business in minutes using AI**

An intelligent platform that analyzes domain names and automatically creates complete business websites using advanced AI agents.

## Features

- **Domain Analysis**: Comprehensive analysis of multiple domains including WHOIS, DNS, and existing content
- **Smart Ranking**: AI-powered scoring based on brandability, memorability, SEO potential, and availability
- **Business Strategy Generation**: AI creates complete business models, brand strategies, and MVP scopes
- **Automated Website Creation**: AI agents collaboratively build production-ready landing pages
- **Full Stack Implementation**: Complete with design systems, content, forms, and deployment

## Architecture

### Core Components

1. **Domain Analyzer**
   - Domain Researcher: WHOIS, DNS, and availability checking
   - Web Crawler: Analyzes existing websites using Puppeteer
   - Domain Ranker: Scores domains on multiple criteria

2. **Business Strategy Engine**
   - Uses Claude and GPT-4 to generate comprehensive business strategies
   - Defines business models, target markets, and value propositions
   - Creates brand positioning and visual identity directions

3. **Agent Orchestration System**
   - Design Agent: Creates design systems and wireframes
   - Content Agent: Generates SEO-optimized content
   - Development Agent: Builds responsive websites
   - Deployment Agent: Handles deployment to various platforms

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd domain-analyzer

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your API keys
# Required: OPENAI_API_KEY and ANTHROPIC_API_KEY
```

## Usage

### Start the Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

Visit `http://localhost:3000` to access the web interface.

### API Endpoints

#### Analyze Domains
```bash
POST /api/analyze
Content-Type: application/json

{
  "domains": ["example.com", "startup.io", "nextgen.ai"]
}
```

#### Generate Strategy
```bash
POST /api/strategy
Content-Type: application/json

{
  "domainAnalysis": { /* analysis result */ }
}
```

#### Execute Full Pipeline
```bash
POST /api/execute
Content-Type: application/json

{
  "domains": ["example.com", "startup.io"]
}
```

## Workflow

1. **Input Domains**: Enter multiple domain names to analyze
2. **Analysis Phase**: 
   - Checks domain availability
   - Analyzes existing content
   - Scores based on multiple factors
3. **Strategy Generation**:
   - AI determines best business model
   - Creates brand strategy
   - Defines MVP scope
4. **Website Creation**:
   - Design agent creates visual system
   - Content agent writes all copy
   - Development agent builds the site
   - Deployment agent publishes it

## Configuration

### Deployment Methods

Set `DEPLOYMENT_METHOD` in `.env`:
- `local`: Creates local deployment with instructions
- `netlify`: Deploys to Netlify (requires CLI)
- `vercel`: Deploys to Vercel (requires CLI)
- `github`: Deploys to GitHub Pages

### Redis (Optional)

For production use, Redis is recommended for job queue management:
```bash
# Install Redis locally
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu

# Start Redis
redis-server
```

## Development

### Project Structure
```
domain-analyzer/
├── src/
│   ├── analyzers/     # Domain analysis components
│   ├── agents/        # AI agent implementations
│   ├── models/        # Business strategy models
│   ├── api/           # Express routes
│   └── utils/         # Utilities and helpers
├── public/            # Web interface
├── output/            # Generated websites
└── deployments/       # Local deployments
```

### Adding New Agents

1. Create agent class in `src/agents/`
2. Implement `execute()` method
3. Register in `AgentOrchestrator`

### Customizing Scoring

Edit weights in `DomainRanker` constructor to adjust ranking priorities.

## Requirements

- Node.js 18+
- Redis (optional, for production)
- API Keys:
  - OpenAI API key
  - Anthropic API key

## License

MIT