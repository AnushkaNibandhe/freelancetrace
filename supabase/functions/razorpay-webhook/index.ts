import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!signature || !RAZORPAY_KEY_SECRET) {
      throw new Error('Missing signature or secret');
    }

    // Verify webhook signature
    const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Signature mismatch');
      throw new Error('Invalid signature');
    }

    const event = JSON.parse(body);
    console.log('Razorpay webhook event:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      // Find payment by provider_payment_id (order_id)
      const { data: paymentRecord, error: fetchError } = await supabaseClient
        .from('payments')
        .select('*, milestone:milestones(contract:contracts(freelancer_id, project:projects(title)))')
        .eq('provider_payment_id', orderId)
        .single();

      if (fetchError || !paymentRecord) {
        console.error('Payment record not found:', orderId);
        throw new Error('Payment record not found');
      }

      // Update payment status
      const { error: updateError } = await supabaseClient
        .from('payments')
        .update({
          status: 'completed',
          paid_at: new Date().toISOString(),
        })
        .eq('id', paymentRecord.id);

      if (updateError) {
        console.error('Error updating payment:', updateError);
        throw updateError;
      }

      // Update milestone status to approved
      await supabaseClient
        .from('milestones')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', paymentRecord.milestone_id);

      // Create notification for freelancer
      const freelancerId = paymentRecord.milestone?.contract?.freelancer_id;
      const projectTitle = paymentRecord.milestone?.contract?.project?.title;

      if (freelancerId) {
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: freelancerId,
            type: 'payment_received',
            title: 'Payment Received',
            message: `You received $${paymentRecord.net_amount.toLocaleString()} for ${projectTitle}`,
            data: {
              payment_id: paymentRecord.id,
              milestone_id: paymentRecord.milestone_id,
              amount: paymentRecord.net_amount,
            },
          });
      }

      console.log('Payment processed successfully:', paymentRecord.id);
    } else if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      // Update payment status to failed
      await supabaseClient
        .from('payments')
        .update({ status: 'failed' })
        .eq('provider_payment_id', orderId);

      console.log('Payment failed:', orderId);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Webhook error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
