import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_email } = req.query;

    // Get active jobs
    const { data: jobs, error } = await supabase
      .from('site_jobs')
      .select(`
        id,
        domain,
        status,
        progress,
        result,
        created_at,
        updated_at,
        estimated_completion
      `)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    // Generate HTML for the jobs
    const jobsHtml = jobs.length > 0 
      ? jobs.map(job => generateJobHtml(job)).join('')
      : `
        <div class="text-center py-8">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
            </svg>
          </div>
          <p class="text-gray-500 text-lg mb-2">No active jobs</p>
          <p class="text-gray-400 text-sm">Your new sites will appear here while they're being built.</p>
        </div>
      `;

    // Set content type to HTML for htmx
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(jobsHtml);

  } catch (error) {
    console.error('Dashboard jobs error:', error);
    
    const errorHtml = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <p class="text-red-800">Failed to load jobs. Please refresh the page.</p>
        </div>
      </div>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorHtml);
  }
}

function generateJobHtml(job) {
  const statusColor = {
    'queued': 'yellow',
    'processing': 'blue',
    'completed': 'green',
    'failed': 'red'
  }[job.status] || 'gray';

  const statusIcon = {
    'queued': `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>`,
    'processing': `<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>`,
    'completed': `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    'failed': `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`
  }[job.status] || '';

  const progress = job.progress || 0;
  const timeAgo = getTimeAgo(job.created_at);

  return `
    <div class="border border-gray-200 rounded-lg p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-3">
          <div class="text-${statusColor}-500">
            ${statusIcon}
          </div>
          <div>
            <h3 class="font-medium text-gray-900">${job.domain}</h3>
            <p class="text-sm text-gray-500">Started ${timeAgo}</p>
          </div>
        </div>
        <span class="px-2 py-1 text-xs font-medium rounded-full bg-${statusColor}-100 text-${statusColor}-800 capitalize">
          ${job.status}
        </span>
      </div>
      
      ${job.status === 'processing' ? `
        <div class="mb-3">
          <div class="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>${progress}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        </div>
      ` : ''}
      
      ${job.status === 'completed' && job.result?.deployed_url ? `
        <div class="flex items-center space-x-2">
          <a href="${job.result.deployed_url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
            View Site →
          </a>
        </div>
      ` : ''}
      
      ${job.status === 'failed' ? `
        <div class="text-red-600 text-sm">
          <p>Build failed. Please try again or contact support.</p>
        </div>
      ` : ''}
    </div>
  `;
}

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
} 