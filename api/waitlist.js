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
    const { email, name, interest } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        error: 'Valid email address is required' 
      });
    }

    // Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from('waitlist_signups')
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
        message: 'Thanks! You\'re already on our waitlist.',
        html: `
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <p class="text-blue-800">You're already on our waitlist! We'll notify you when we launch.</p>
            </div>
          </div>
        `
      });
    }

    // Add to waitlist
    const { data, error } = await supabase
      .from('waitlist_signups')
      .insert({
        email,
        name: name || null,
        source: interest || null,
        signed_up_at: new Date().toISOString(),
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent']
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Get current waitlist count
    const { count, error: countError } = await supabase
      .from('waitlist_signups')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting waitlist count:', countError);
    }

    // Return success response with updated HTML
    return res.status(200).json({
      success: true,
      message: 'Successfully joined the waitlist!',
      count: count || 0,
      html: `
        <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div class="flex items-center justify-center mb-4">
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
          </div>
          <h3 class="text-lg font-semibold text-green-800 mb-2">You're In! 🎉</h3>
          <p class="text-green-700 mb-4">
            Welcome to the waitlist! You're #${count || '?'} in line.
          </p>
          <p class="text-sm text-green-600">
            We'll send you updates and notify you the moment we launch. 
            Get ready for something amazing!
          </p>
          <div class="mt-4 pt-4 border-t border-green-200">
            <p class="text-xs text-green-600">
              💌 Check your email for a confirmation message
            </p>
          </div>
        </div>
      `
    });

  } catch (error) {
    console.error('Waitlist signup error:', error);
    
    return res.status(500).json({
      error: 'Failed to join waitlist',
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