import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import httpx
from supabase import create_client, Client
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SiteGenerationWorker:
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        )
        self.openai = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.worker_id = f"worker_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.is_running = True
        
        logger.info(f"🤖 Site Generation Worker initialized: {self.worker_id}")

    async def poll_queue(self):
        """Main queue polling loop"""
        logger.info("🔄 Starting queue polling...")
        
        while self.is_running:
            try:
                # Dequeue a job from site_jobs queue
                result = self.supabase.rpc('dequeue_job', {
                    'queue_name': 'site_jobs',
                    'worker_id': self.worker_id
                }).execute()
                
                if result.data and len(result.data) > 0:
                    job = result.data[0]
                    logger.info(f"📋 Processing job: {job['payload']['site_job_id']}")
                    
                    # Process the job
                    await self.process_job(job['payload'])
                    
                else:
                    # No jobs available, wait before polling again
                    await asyncio.sleep(5)
                    
            except Exception as e:
                logger.error(f"❌ Queue polling error: {e}")
                await asyncio.sleep(10)

    async def process_job(self, payload: Dict[str, Any]):
        """Process a single site generation job"""
        site_job_id = payload['site_job_id']
        domain = payload['domain']
        job_data = payload.get('job_data', {})
        
        logger.info(f"🚀 Starting job processing for {domain} (Job ID: {site_job_id})")
        
        try:
            # Update job status to processing
            await self.update_job_status(site_job_id, 'processing')
            await self.update_progress(site_job_id, 'initialize', 'running', 0, 'Starting site generation...')
            
            # Step 1: Domain Analysis
            await self.update_progress(site_job_id, 'analyze', 'running', 10, 'Analyzing domain...')
            domain_analysis = await self.analyze_domain(domain, job_data)
            await self.update_progress(site_job_id, 'analyze', 'completed', 20, 'Domain analysis completed')
            
            # Step 2: Strategy Generation
            await self.update_progress(site_job_id, 'strategy', 'running', 30, 'Generating business strategy...')
            strategy = await self.generate_strategy(domain, domain_analysis, job_data)
            await self.update_progress(site_job_id, 'strategy', 'completed', 40, 'Business strategy generated')
            
            # Step 3: Design System
            await self.update_progress(site_job_id, 'design', 'running', 50, 'Creating design system...')
            design_system = await self.generate_design(domain, strategy, job_data)
            await self.update_progress(site_job_id, 'design', 'completed', 60, 'Design system created')
            
            # Step 4: Content Generation
            await self.update_progress(site_job_id, 'content', 'running', 70, 'Generating website content...')
            content = await self.generate_content(domain, strategy, design_system, job_data)
            await self.update_progress(site_job_id, 'content', 'completed', 80, 'Content generated')
            
            # Step 5: Website Building
            await self.update_progress(site_job_id, 'build', 'running', 85, 'Building website...')
            website = await self.build_website(domain, strategy, design_system, content, job_data)
            await self.update_progress(site_job_id, 'build', 'completed', 90, 'Website built')
            
            # Step 6: Deployment
            await self.update_progress(site_job_id, 'deploy', 'running', 95, 'Deploying website...')
            deployment = await self.deploy_website(website, domain, job_data)
            await self.update_progress(site_job_id, 'deploy', 'completed', 100, 'Website deployed successfully')
            
            # Save final results
            result_data = {
                'domain': domain,
                'domain_analysis': domain_analysis,
                'strategy': strategy,
                'design_system': design_system,
                'content': content,
                'website': website,
                'deployment': deployment,
                'completed_at': datetime.now().isoformat()
            }
            
            # Update job as completed
            await self.update_job_status(site_job_id, 'completed', result_data)
            
            # Create site record
            await self.create_site_record(site_job_id, domain, result_data, job_data)
            
            logger.info(f"✅ Job completed successfully for {domain}")
            
        except Exception as e:
            logger.error(f"❌ Job failed for {domain}: {e}")
            await self.update_job_status(site_job_id, 'failed', error_message=str(e))
            await self.update_progress(site_job_id, 'error', 'failed', 0, f'Job failed: {str(e)}')

    async def analyze_domain(self, domain: str, job_data: Dict) -> Dict[str, Any]:
        """Analyze domain using AI"""
        logger.info(f"🔍 Analyzing domain: {domain}")
        
        # Check if we have existing analysis data
        if job_data.get('bestDomainData'):
            logger.info("Using provided domain analysis data")
            return job_data['bestDomainData']
        
        # Call domain analysis API
        try:
            request_origin = job_data.get('requestOrigin', 'https://domaintobiz.vercel.app')
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{request_origin}/api/analyze", json={
                    'domains': [domain]
                }, timeout=120)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        return data['data']['bestDomain']
                
                raise Exception(f"Domain analysis API failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Domain analysis failed: {e}")
            # Return fallback analysis
            return {
                'domain': domain,
                'score': 75,
                'aiInsights': {
                    'businessConcept': f"Business concept for {domain}",
                    'targetAudience': 'General audience',
                    'brandability': 75,
                    'seoScore': 70,
                    'marketAppeal': 80
                },
                'fallback': True
            }

    async def generate_strategy(self, domain: str, domain_analysis: Dict, job_data: Dict) -> Dict[str, Any]:
        """Generate business strategy using AI"""
        logger.info(f"📋 Generating strategy for: {domain}")
        
        try:
            request_origin = job_data.get('requestOrigin', 'https://domaintobiz.vercel.app')
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{request_origin}/api/strategy", json={
                    'domainAnalysis': domain_analysis,
                    'analysisId': f"worker_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    'regenerate': job_data.get('regenerate', False),
                    'userComments': job_data.get('comments'),
                    'projectId': job_data.get('projectId')
                }, timeout=120)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        return data['data']
                
                raise Exception(f"Strategy generation failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Strategy generation failed: {e}")
            raise

    async def generate_design(self, domain: str, strategy: Dict, job_data: Dict) -> Dict[str, Any]:
        """Generate design system using AI"""
        logger.info(f"🎨 Generating design for: {domain}")
        
        try:
            request_origin = job_data.get('requestOrigin', 'https://domaintobiz.vercel.app')
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{request_origin}/api/agents/design", json={
                    'domain': domain,
                    'strategy': strategy,
                    'executionId': f"worker_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                }, timeout=120)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        return data['data']
                
                # Return fallback design
                return {
                    'colorPalette': {
                        'primary': '#3B82F6',
                        'secondary': '#1E40AF',
                        'accent': '#60A5FA',
                        'background': '#FFFFFF',
                        'text': '#1F2937'
                    },
                    'typography': {
                        'primary': 'Inter',
                        'secondary': 'system-ui'
                    },
                    'layout': 'modern-minimal',
                    'fallback': True
                }
                
        except Exception as e:
            logger.error(f"❌ Design generation failed: {e}")
            # Return fallback design
            return {
                'colorPalette': {
                    'primary': '#3B82F6',
                    'secondary': '#1E40AF',
                    'accent': '#60A5FA',
                    'background': '#FFFFFF',
                    'text': '#1F2937'
                },
                'typography': {
                    'primary': 'Inter',
                    'secondary': 'system-ui'
                },
                'layout': 'modern-minimal',
                'fallback': True
            }

    async def generate_content(self, domain: str, strategy: Dict, design_system: Dict, job_data: Dict) -> Dict[str, Any]:
        """Generate website content using AI"""
        logger.info(f"✍️ Generating content for: {domain}")
        
        try:
            request_origin = job_data.get('requestOrigin', 'https://domaintobiz.vercel.app')
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{request_origin}/api/agents/content", json={
                    'domain': domain,
                    'strategy': strategy,
                    'designSystem': design_system,
                    'executionId': f"worker_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    'regenerate': job_data.get('regenerate', False),
                    'userComments': job_data.get('comments'),
                    'projectId': job_data.get('projectId')
                }, timeout=120)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        return data['data']
                
                raise Exception(f"Content generation failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Content generation failed: {e}")
            raise

    async def build_website(self, domain: str, strategy: Dict, design_system: Dict, content: Dict, job_data: Dict) -> Dict[str, Any]:
        """Build the actual website"""
        logger.info(f"🏗️ Building website for: {domain}")
        
        try:
            request_origin = job_data.get('requestOrigin', 'https://domaintobiz.vercel.app')
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{request_origin}/api/generate-website", json={
                    'domain': domain,
                    'strategy': strategy,
                    'designSystem': design_system,
                    'websiteContent': content,
                    'executionId': f"worker_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    'regenerate': job_data.get('regenerate', False),
                    'userComments': job_data.get('comments'),
                    'projectId': job_data.get('projectId')
                }, timeout=300)  # Longer timeout for website generation
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        return data['data']
                
                raise Exception(f"Website building failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Website building failed: {e}")
            raise

    async def deploy_website(self, website: Dict, domain: str, job_data: Dict) -> Dict[str, Any]:
        """Deploy the generated website"""
        logger.info(f"🚀 Deploying website for: {domain}")
        
        # Website should already be deployed by the generate-website API
        deployment_url = website.get('deploymentUrl')
        if deployment_url:
            return {
                'url': deployment_url,
                'status': 'deployed',
                'deployedAt': datetime.now().isoformat()
            }
        else:
            raise Exception("No deployment URL returned from website generation")

    async def update_job_status(self, job_id: str, status: str, result_data: Optional[Dict] = None, error_message: Optional[str] = None):
        """Update job status in database"""
        try:
            update_data = {
                'status': status,
                'worker_id': self.worker_id
            }
            
            if status == 'processing':
                update_data['started_at'] = datetime.now().isoformat()
            elif status in ['completed', 'failed']:
                update_data['completed_at'] = datetime.now().isoformat()
            
            if result_data:
                update_data['result_data'] = result_data
            
            if error_message:
                update_data['error_message'] = error_message
            
            self.supabase.table('site_jobs').update(update_data).eq('id', job_id).execute()
            logger.info(f"📊 Job {job_id} status updated to: {status}")
            
        except Exception as e:
            logger.error(f"❌ Failed to update job status: {e}")

    async def update_progress(self, job_id: str, step_name: str, status: str, progress: int, message: str):
        """Update job progress"""
        try:
            self.supabase.rpc('update_job_progress', {
                'p_job_id': job_id,
                'p_step_name': step_name,
                'p_status': status,
                'p_progress': progress,
                'p_message': message
            }).execute()
            
            logger.info(f"📈 Progress: {step_name} - {status} ({progress}%): {message}")
            
        except Exception as e:
            logger.error(f"❌ Failed to update progress: {e}")

    async def create_site_record(self, job_id: str, domain: str, result_data: Dict, job_data: Dict):
        """Create site record in database"""
        try:
            subdomain = domain.replace('.', '-').replace('_', '-').lower()
            
            site_data = {
                'job_id': job_id,
                'user_id': job_data.get('userId'),
                'domain': domain,
                'subdomain': subdomain,
                'business_model': result_data.get('strategy', {}),
                'content_data': result_data.get('content', {}),
                'design_data': result_data.get('design_system', {}),
                'deployment_url': result_data.get('deployment', {}).get('url'),
                'status': 'deployed',
                'deployed_at': datetime.now().isoformat()
            }
            
            self.supabase.table('sites').insert(site_data).execute()
            logger.info(f"💾 Site record created for: {domain}")
            
        except Exception as e:
            logger.error(f"❌ Failed to create site record: {e}")

    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("🛑 Shutting down worker...")
        self.is_running = False

async def main():
    """Main entry point"""
    worker = SiteGenerationWorker()
    
    try:
        await worker.poll_queue()
    except KeyboardInterrupt:
        logger.info("👋 Received shutdown signal")
        await worker.shutdown()
    except Exception as e:
        logger.error(f"❌ Worker crashed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 