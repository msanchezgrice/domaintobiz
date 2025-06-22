import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  console.log('Received Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleCheckoutSessionCompleted(session) {
  console.log('Processing checkout.session.completed:', session.id);

  try {
    // Get the subscription details
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const customer = await stripe.customers.retrieve(session.customer);

    // Extract plan information from metadata
    const plan = session.metadata?.plan || 'starter';
    const billing = session.metadata?.billing || 'monthly';
    const userId = session.metadata?.user_id;

    // Create or update user record
    const userData = {
      email: customer.email || session.customer_email,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      plan: plan,
      billing_cycle: billing,
      subscription_status: 'active',
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update payment session status
    await supabase
      .from('payment_sessions')
      .update({ 
        status: 'completed',
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        completed_at: new Date().toISOString()
      })
      .eq('stripe_session_id', session.id);

    // Create or update user subscription
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update(userData)
        .eq('id', existingUser.id);

      if (updateError) throw updateError;
    } else {
      // Create new user
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          ...userData,
          id: userId || crypto.randomUUID(),
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
    }

    // Update any existing sites to paid status
    await supabase
      .from('sites')
      .update({ 
        paid: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_email', userData.email);

    // Trigger redeploy for paid sites (if needed)
    if (process.env.VERCEL_DEPLOY_HOOK_URL) {
      try {
        await fetch(process.env.VERCEL_DEPLOY_HOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'payment_completed',
            customer: userData.email,
            plan: plan
          })
        });
      } catch (deployError) {
        console.error('Deploy hook failed:', deployError);
        // Don't fail the webhook for this
      }
    }

    console.log('Successfully processed checkout completion for:', userData.email);

  } catch (error) {
    console.error('Error processing checkout.session.completed:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('Processing subscription.created:', subscription.id);
  
  try {
    const customer = await stripe.customers.retrieve(subscription.customer);
    
    const { error } = await supabase
      .from('users')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', subscription.customer);

    if (error) throw error;
  } catch (error) {
    console.error('Error processing subscription.created:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Processing subscription.updated:', subscription.id);
  
  try {
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error processing subscription.updated:', error);
    throw error;
  }
}

async function handleSubscriptionCanceled(subscription) {
  console.log('Processing subscription.deleted:', subscription.id);
  
  try {
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: 'canceled',
        plan: 'free',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) throw error;

    // Update sites to unpaid status
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (user) {
      await supabase
        .from('sites')
        .update({ 
          paid: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_email', user.email);
    }
  } catch (error) {
    console.error('Error processing subscription.deleted:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);
  
  try {
    // Update subscription status to active if it was past_due
    if (invoice.subscription) {
      const { error } = await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', invoice.subscription);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error processing invoice.payment_succeeded:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);
  
  try {
    if (invoice.subscription) {
      const { error } = await supabase
        .from('users')
        .update({
          subscription_status: 'past_due',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', invoice.subscription);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error processing invoice.payment_failed:', error);
    throw error;
  }
} 