import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        error: 'Valid email address is required' 
      });
    }

    // Check if email already exists in newsletter
    const { data: existing, error: checkError } = await supabase
      .from('newsletter_signups')
      .select('email')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      // Email already exists - return success message anyway for security
      return res.status(200).json({
        success: true,
        message: 'You\'re already subscribed to our newsletter!',
        html: `
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <p class="text-blue-800">You're already subscribed to our newsletter!</p>
            </div>
          </div>
        `
      });
    }

    // Add to newsletter
    const { data, error } = await supabase
      .from('newsletter_signups')
      .insert({
        email,
        signed_up_at: new Date().toISOString(),
        source: 'waitlist_page',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent']
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Get current newsletter subscriber count
    const { count, error: countError } = await supabase
      .from('newsletter_signups')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting newsletter count:', countError);
    }

    // Return success response with updated HTML
    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed to newsletter!',
      count: count || 0,
      html: `
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div class="flex items-center justify-center mb-3">
            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
          </div>
          <h3 class="text-lg font-semibold text-green-800 mb-2">You're Subscribed! 🎉</h3>
          <p class="text-green-700 text-sm">
            Thanks for subscribing! You'll get weekly updates on our progress and exclusive insights.
          </p>
        </div>
      `
    });

  } catch (error) {
    console.error('Newsletter signup error:', error);
    
    return res.status(500).json({
      error: 'Failed to subscribe to newsletter',
      message: 'Something went wrong. Please try again.',
      html: `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <p class="text-red-800">Oops! Something went wrong. Please try again.</p>
          </div>
        </div>
      `
    });
  }
} 