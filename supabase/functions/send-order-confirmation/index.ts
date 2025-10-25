import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
serve(async (req) => {
  console.log('=== Edge function called ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }
  try {
    // Clone the request to be able to read the body multiple times
    const reqClone = req.clone();
    // Try to get the raw body text
    let rawBody = '';
    try {
      rawBody = await req.text();
      console.log('Raw body received:', rawBody);
      console.log('Body length:', rawBody.length);
      console.log('Body type:', typeof rawBody);
    } catch (bodyError) {
      console.error('Error reading body:', bodyError);
      // Try alternative method
      try {
        const reader = reqClone.body?.getReader();
        if (reader) {
          const chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const bodyArray = new Uint8Array(
            chunks.reduce((acc, chunk) => acc + chunk.length, 0)
          );
          let offset = 0;
          for (const chunk of chunks) {
            bodyArray.set(chunk, offset);
            offset += chunk.length;
          }
          rawBody = new TextDecoder().decode(bodyArray);
          console.log('Body read via reader:', rawBody);
        }
      } catch (readerError) {
        console.error('Error reading body via reader:', readerError);
      }
    }
    // Parse the body
    let body = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
        console.log('Parsed body:', JSON.stringify(body));
        console.log('Body keys:', Object.keys(body));
        console.log('Has to:', 'to' in body);
        console.log('Has orderDetails:', 'orderDetails' in body);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse:', rawBody);
      }
    } else {
      console.log('No body received');
    }
    const { to, orderDetails, trackingUrl } = body;
    const emailType = (body as any).emailType || 'confirmation';
    console.log('Extracted values:');
    console.log('- to:', to);
    console.log('- orderDetails:', orderDetails ? 'present' : 'missing');
    console.log('- trackingUrl:', trackingUrl);
    console.log('- emailType:', emailType);
    // Check if RESEND_API_KEY is set
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY not set, returning mock success');
      // Return mock success for testing
      return new Response(
        JSON.stringify({
          success: true,
          message:
            'Email service not configured (no RESEND_API_KEY). Mock response for testing.',
          receivedData: {
            to: to || 'not provided',
            orderNumber: orderDetails?.orderNumber || 'not provided',
            hasOrderDetails: !!orderDetails,
            bodyWasReceived: !!rawBody,
            bodyLength: rawBody.length,
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    // Validate required fields
    if (!to || !orderDetails) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: to, orderDetails',
          received: {
            hasTo: !!to,
            hasOrderDetails: !!orderDetails,
            bodyReceived: !!rawBody,
            bodyLength: rawBody.length,
            bodyPreview: rawBody.substring(0, 100),
          },
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    // Rest of the email sending logic...
    console.log('Would send email to:', to);
    console.log('Order number:', orderDetails.orderNumber);

    // Build email template based on type
    const isReadyEmail = emailType === 'ready';
    const customerName = orderDetails.customer?.name || 'Client';

    // Different content for confirmation vs ready emails
    const emailTitle = isReadyEmail
      ? 'Votre commande est prête !'
      : 'Merci pour votre commande !';
    const emailGreeting = isReadyEmail
      ? `Bonjour ${customerName},\n\nBonne nouvelle ! Votre commande est maintenant prête et vous attend.`
      : `Bonjour ${customerName},\n\nNous avons bien reçu votre commande. Voici un récapitulatif :`;

    const actionMessage = isReadyEmail
      ? getReadyActionMessage(orderDetails.orderType)
      : '';

    const emailSubject = isReadyEmail
      ? `Commande prête - #${orderDetails.orderNumber}`
      : `Order Confirmation - #${orderDetails.orderNumber}`;

    const itemsHtml = Array.isArray(orderDetails.items)
      ? orderDetails.items
          .map(
            (item: any) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
            ${item.name || item.title || item.productName || 'Article inconnu'}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">
            ${item.quantity}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">
            ${item.price} €
          </td>
        </tr>
      `
          )
          .join('')
      : '';
    const trackingRow = trackingUrl
      ? `<tr><td colspan="3" style="padding: 16px 0; text-align: center;">
            <a href="${trackingUrl}" style="display: inline-block; background: #4f8cff; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Suivre ma commande</a>
          </td></tr>`
      : '';
    const notesRow = orderDetails.notes
      ? `<tr><td colspan="3" style="padding: 8px 0; color: #555;"><strong>Notes :</strong> ${orderDetails.notes}</td></tr>`
      : '';
    const scheduledTimeRow = orderDetails.scheduledTime
      ? `<tr><td colspan="3" style="padding: 8px 0; color: #555;"><strong>Heure prévue :</strong> ${orderDetails.scheduledTime}</td></tr>`
      : '';

    // Function to get action message based on order type
    function getReadyActionMessage(orderType: string): string {
      switch (orderType) {
        case 'eat-in':
          return '<p style="background: #e8f5e8; padding: 16px; border-radius: 6px; border-left: 4px solid #4caf50;"><strong>Votre table vous attend !</strong> Rendez-vous au restaurant pour déguster votre commande.</p>';
        case 'take-away':
          return '<p style="background: #e8f5e8; padding: 16px; border-radius: 6px; border-left: 4px solid #4caf50;"><strong>Prêt à emporter !</strong> Votre commande vous attend au comptoir.</p>';
        case 'delivery':
          return '<p style="background: #e8f5e8; padding: 16px; border-radius: 6px; border-left: 4px solid #4caf50;"><strong>En cours de livraison !</strong> Votre commande arrive chez vous.</p>';
        default:
          return '<p style="background: #e8f5e8; padding: 16px; border-radius: 6px; border-left: 4px solid #4caf50;"><strong>Commande prête !</strong> Venez récupérer votre commande.</p>';
      }
    }

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7f9fb; color: #222; padding: 0; margin: 0;">
        <div style="background: #4f8cff; color: #fff; padding: 24px 0; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 2rem;">${emailTitle}</h1>
        </div>
        <div style="background: #fff; max-width: 600px; margin: 24px auto; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); padding: 32px 24px;">
          <p style="font-size: 1.1rem;">${emailGreeting}</p>
          ${actionMessage}
          <table style="margin: 24px 0 16px 0; width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0;"><strong>Numéro de commande :</strong></td>
              <td style="padding: 6px 0;">${orderDetails.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;"><strong>Statut :</strong></td>
              <td style="padding: 6px 0;">${orderDetails.status}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;"><strong>Type :</strong></td>
              <td style="padding: 6px 0;">${orderDetails.orderType}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;"><strong>Timing :</strong></td>
              <td style="padding: 6px 0;">${orderDetails.timing}</td>
            </tr>
            ${scheduledTimeRow}
          </table>
          <h2 style="margin-top: 32px; color: #4f8cff; font-size: 1.2rem;">Détails de la commande</h2>
          <table style="width: 100%; border-collapse: collapse; background: #f7f9fb; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background: #eaf1fb;">
                <th style="padding: 8px 12px; text-align: left;">Article</th>
                <th style="padding: 8px 12px; text-align: center;">Quantité</th>
                <th style="padding: 8px 12px; text-align: right;">Prix</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="background: #f0f4fa;">
                <td colspan="2" style="padding: 8px 12px; text-align: right;"><strong>Total :</strong></td>
                <td style="padding: 8px 12px; text-align: right;"><strong>${orderDetails.totalAmount} €</strong></td>
              </tr>
              ${trackingRow}
              ${notesRow}
            </tbody>
          </table>
          <p style="margin-top: 32px;">Si vous avez des questions ou besoin d'aide, il vous suffit de répondre à cet e-mail. Nous sommes là pour vous !</p>
          <p style="margin-top: 24px; color: #4f8cff; font-weight: bold;">À très bientôt,<br>L'équipe Piki</p>
        </div>
      </div>
    `;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'serviceclient@piki-app.com',
          to: to,
          subject: emailSubject,
          html,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          `Resend API error: ${errorData.message || res.statusText}`
        );
      }
      const data = await res.json();
      return new Response(
        JSON.stringify({
          success: true,
          data,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (sendError) {
      console.error('Error sending email via Resend:', sendError);
      let errorMessage = 'Failed to send email via Resend';
      let errorStack = undefined;
      if (sendError && typeof sendError === 'object') {
        if ('message' in sendError && typeof sendError.message === 'string') {
          errorMessage = sendError.message;
        }
        if ('stack' in sendError && typeof sendError.stack === 'string') {
          errorStack = sendError.stack;
        }
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          details: errorStack,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Edge function error:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        type: error.constructor?.name || 'Unknown',
        stack: error.stack,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
