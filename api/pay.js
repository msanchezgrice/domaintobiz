import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
  apiVersion: '2023-10-16' 
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Plan configurations
const PLANS = {
  starter: {
    monthly: {
      price_id: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || 'price_starter_monthly',
      amount: 2900, // $29.00
    },
    yearly: {
      price_id: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || 'price_starter_yearly',
      amount: 27800, // $278.00 (save $70)
    }
  },
  pro: {
    monthly: {
      price_id: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      amount: 9900, // $99.00
    },
    yearly: {
      price_id: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
      amount: 95000, // $950.00 (save $238)
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan = 'starter', billing = 'monthly', email, userId } = req.body;
    const origin = req.headers.origin || 'https://domaintobiz.vercel.app';

    // Validate plan
    if (!PLANS[plan] || !PLANS[plan][billing]) {
      return res.status(400).json({ 
        error: 'Invalid plan or billing cycle',
        html: `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-800">Invalid plan selected. Please try again.</p>
          </div>
        `
      });
    }

    const selectedPlan = PLANS[plan][billing];

    // Create checkout session metadata
    const metadata = {
      plan: plan,
      billing: billing,
      user_id: userId || 'anonymous',
      created_at: new Date().toISOString()
    };

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPlan.price_id,
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      metadata: metadata,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: {
        enabled: true,
      },
      consent_collection: {
        terms_of_service: 'required',
      },
      custom_text: {
        submit: {
          message: 'Start building amazing websites today!'
        }
      },
      // Free trial for new customers
      subscription_data: {
        trial_period_days: 14,
        metadata: metadata
      }
    });

    // Store the session in our database for tracking
    try {
      await supabase
        .from('payment_sessions')
        .insert({
          stripe_session_id: session.id,
          plan: plan,
          billing: billing,
          amount: selectedPlan.amount,
          user_id: userId || null,
          email: email || null,
          status: 'pending',
          created_at: new Date().toISOString()
        });
    } catch (dbError) {
      console.error('Failed to store payment session:', dbError);
      // Continue anyway - Stripe session is more important
    }

    // For htmx requests, return a redirect response
    if (req.headers['hx-request']) {
      res.setHeader('HX-Redirect', session.url);
      return res.status(200).json({
        success: true,
        redirect_url: session.url,
        session_id: session.id
      });
    }

    // For regular requests, return JSON with redirect URL
    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error) {
    console.error('Stripe payment error:', error);

    const errorMessage = error.type === 'StripeCardError' 
      ? 'Payment failed. Please check your card details.'
      : 'Payment system temporarily unavailable. Please try again.';

    return res.status(500).json({
      error: 'Payment failed',
      message: errorMessage,
      html: `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <div>
              <p class="text-red-800 font-medium">Payment Error</p>
              <p class="text-red-700 text-sm">${errorMessage}</p>
            </div>
          </div>
        </div>
      `
    });
  }
} 