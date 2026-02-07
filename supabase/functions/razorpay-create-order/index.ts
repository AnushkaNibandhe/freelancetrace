import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      throw new Error('Invalid authorization');
    }

    const { milestone_id } = await req.json();
    
    if (!milestone_id) {
      throw new Error('Missing milestone_id');
    }

    // Get milestone details with contract and project info
    const { data: milestone, error: milestoneError } = await supabaseClient
      .from('milestones')
      .select(`
        *,
        contract:contracts(
          id, client_id, freelancer_id,
          project:projects(title)
        )
      `)
      .eq('id', milestone_id)
      .single();

    if (milestoneError || !milestone) {
      throw new Error('Milestone not found');
    }

    // Verify user is the client
    if (milestone.contract?.client_id !== user.id) {
      throw new Error('Only the client can initiate payment');
    }

    // Get Razorpay credentials
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }

    // Create Razorpay order
    const amountInPaise = Math.round(milestone.amount * 100);
    
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `milestone_${milestone_id}`,
        notes: {
          milestone_id,
          project_title: milestone.contract?.project?.title,
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('Razorpay error:', errorData);
      throw new Error('Failed to create Razorpay order');
    }

    const order = await orderResponse.json();

    // Calculate platform fee (5%)
    const platformFee = Math.round(milestone.amount * 0.05 * 100) / 100;
    const netAmount = milestone.amount - platformFee;

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        milestone_id,
        contract_id: milestone.contract?.id,
        payer_id: milestone.contract?.client_id,
        payee_id: milestone.contract?.freelancer_id,
        amount: milestone.amount,
        platform_fee: platformFee,
        net_amount: netAmount,
        payment_provider: 'razorpay',
        provider_payment_id: order.id,
        status: 'pending',
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment record error:', paymentError);
      throw new Error('Failed to create payment record');
    }

    // Get user email for prefill
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    console.log('Payment order created:', order.id);

    return new Response(
      JSON.stringify({
        order_id: order.id,
        key_id: RAZORPAY_KEY_ID,
        amount: amountInPaise,
        currency: 'INR',
        description: `Payment for ${milestone.title}`,
        payment_id: payment.id,
        prefill: {
          email: profile?.email,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
