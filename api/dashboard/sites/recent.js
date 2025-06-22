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

    // Get recent completed sites
    const { data: sites, error } = await supabase
      .from('sites')
      .select(`
        id,
        domain,
        title,
        deployed_url,
        thumbnail_url,
        created_at,
        updated_at,
        paid,
        site_jobs!inner(status, result)
      `)
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      throw error;
    }

    // Generate HTML for the sites
    const sitesHtml = sites.length > 0 
      ? sites.map(site => generateSiteHtml(site)).join('')
      : `
        <div class="text-center py-8">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
            </svg>
          </div>
          <p class="text-gray-500 text-lg mb-2">No sites yet</p>
          <p class="text-gray-400 text-sm mb-4">Your completed websites will appear here.</p>
          <button 
            hx-get="/api/create-site-modal"
            hx-target="#modal-container"
            hx-swap="innerHTML"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Create Your First Site
          </button>
        </div>
      `;

    // Set content type to HTML for htmx
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(sitesHtml);

  } catch (error) {
    console.error('Dashboard sites error:', error);
    
    const errorHtml = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <p class="text-red-800">Failed to load sites. Please refresh the page.</p>
        </div>
      </div>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorHtml);
  }
}

function generateSiteHtml(site) {
  const timeAgo = getTimeAgo(site.created_at);
  const domainDisplay = site.domain.length > 20 
    ? site.domain.substring(0, 20) + '...'
    : site.domain;

  const statusBadge = site.paid 
    ? '<span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Paid</span>'
    : '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Free</span>';

  const thumbnailHtml = site.thumbnail_url 
    ? `<img src="${site.thumbnail_url}" alt="${site.title || site.domain}" class="w-full h-32 object-cover rounded-lg mb-3">`
    : `
      <div class="w-full h-32 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg mb-3 flex items-center justify-center">
        <div class="text-white text-center">
          <svg class="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
          </svg>
          <p class="text-sm font-medium">${site.title || domainDisplay}</p>
        </div>
      </div>
    `;

  return `
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      ${thumbnailHtml}
      
      <div class="p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-medium text-gray-900 truncate">${site.title || domainDisplay}</h3>
          ${statusBadge}
        </div>
        
        <p class="text-sm text-gray-500 mb-3">${domainDisplay}</p>
        
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">${timeAgo}</span>
          
          <div class="flex items-center space-x-2">
            ${site.deployed_url ? `
              <a href="${site.deployed_url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                View →
              </a>
            ` : ''}
            
            <button 
              hx-get="/api/site-actions/${site.id}"
              hx-target="#modal-container"
              hx-swap="innerHTML"
              class="text-gray-400 hover:text-gray-600"
              title="Site actions"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
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
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
  
  return date.toLocaleDateString();
} 