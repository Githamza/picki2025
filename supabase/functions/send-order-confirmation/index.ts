import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// VAT rates for France (food service)
const VAT_RATE_FOOD = 10; // 10% for restaurant food

// Helper functions
function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(dateString: string | Date): string {
  return `${formatDate(dateString)} à ${formatTime(dateString)}`;
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function calculateTaxFromTTC(amountTTC: number, vatRate: number): { ht: number; tva: number; ttc: number } {
  const ht = amountTTC / (1 + vatRate / 100);
  const tva = amountTTC - ht;
  return {
    ht: Math.round(ht * 100) / 100,
    tva: Math.round(tva * 100) / 100,
    ttc: amountTTC,
  };
}

function getPaymentMethodLabel(paymentMethod: string, payAtCheckout: boolean): string {
  if (payAtCheckout) {
    return 'Paiement sur place';
  }
  switch (paymentMethod?.toLowerCase()) {
    case 'stripe':
      return 'Carte bancaire (Stripe)';
    case 'paygreen':
      return 'Carte bancaire (PayGreen)';
    case 'card':
      return 'Carte bancaire';
    default:
      return paymentMethod || 'Carte bancaire';
  }
}

function getOrderTypeLabel(orderType: string): string {
  switch (orderType) {
    case 'eat-in':
      return 'Sur place';
    case 'take-away':
      return 'À emporter';
    case 'delivery':
      return 'Livraison';
    default:
      return orderType;
  }
}

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
          const chunks: Uint8Array[] = [];
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
    let body: any = {};
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

    const { to, orderDetails, trackingUrl, vendorInfo } = body;
    const emailType = body.emailType || 'confirmation';

    console.log('Extracted values:');
    console.log('- to:', to);
    console.log('- orderDetails:', orderDetails ? 'present' : 'missing');
    console.log('- vendorInfo:', vendorInfo ? 'present' : 'missing');
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
            hasVendorInfo: !!vendorInfo,
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
    const customerName = orderDetails.customer?.name ||
      `${orderDetails.customer?.firstName || ''} ${orderDetails.customer?.lastName || ''}`.trim() ||
      'Client';
    const currency = vendorInfo?.currency || orderDetails.currency || 'EUR';
    const payAtCheckout = orderDetails.payAtCheckout || false;
    const paymentMethod = getPaymentMethodLabel(vendorInfo?.paymentProvider || orderDetails.paymentMethod, payAtCheckout);
    const orderDateTime = orderDetails.createdAt || new Date().toISOString();

    // Calculate VAT breakdown (assuming all items are food at 10% VAT)
    const totalTTC = orderDetails.totalAmount || 0;
    const discount = orderDetails.discount || 0;
    const taxBreakdown = calculateTaxFromTTC(totalTTC, VAT_RATE_FOOD);

    // Different content for confirmation vs ready emails
    const emailTitle = isReadyEmail
      ? 'Votre commande est prête !'
      : 'Confirmation de commande';
    const emailGreeting = isReadyEmail
      ? `Bonjour ${customerName},\n\nBonne nouvelle ! Votre commande est maintenant prête.`
      : `Bonjour ${customerName},\n\nMerci pour votre commande. Voici votre ticket de caisse :`;

    const actionMessage = isReadyEmail
      ? getReadyActionMessage(orderDetails.orderType)
      : '';

    const emailSubject = isReadyEmail
      ? `Commande prête - #${orderDetails.orderNumber}`
      : `Ticket de caisse - Commande #${orderDetails.orderNumber}`;

    // Build items table with unit price, quantity, and line total
    const itemsHtml = Array.isArray(orderDetails.items)
      ? orderDetails.items
          .map((item: any) => {
            const unitPrice = item.unitPrice || item.price / (item.quantity || 1);
            const lineTotal = item.totalPrice || item.price || (unitPrice * (item.quantity || 1));
            const itemName = item.name || item.title || item.productName || 'Article';
            return `
              <tr>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; font-size: 14px;">
                  ${itemName}
                </td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: right; font-size: 14px;">
                  ${formatCurrency(unitPrice, currency)}
                </td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 14px;">
                  ${item.quantity || 1}
                </td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: right; font-size: 14px;">
                  ${VAT_RATE_FOOD}%
                </td>
                <td style="padding: 10px 8px; border-bottom: 1px solid #e0e0e0; text-align: right; font-size: 14px; font-weight: 500;">
                  ${formatCurrency(lineTotal, currency)}
                </td>
              </tr>
            `;
          })
          .join('')
      : '';

    const trackingButton = trackingUrl
      ? `<div style="text-align: center; margin: 24px 0;">
            <a href="${trackingUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Suivre ma commande</a>
          </div>`
      : '';

    const notesSection = orderDetails.notes
      ? `<div style="background: #fef3c7; padding: 12px 16px; border-radius: 6px; margin-top: 16px; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">Notes :</strong>
            <span style="color: #78350f;">${orderDetails.notes}</span>
          </div>`
      : '';

    const scheduledTimeSection = orderDetails.scheduledTime
      ? `<div style="background: #dbeafe; padding: 12px 16px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #3b82f6;">
            <strong style="color: #1e40af;">Heure prévue :</strong>
            <span style="color: #1e3a8a;">${typeof orderDetails.scheduledTime === 'string' ? orderDetails.scheduledTime : formatDateTime(orderDetails.scheduledTime)}</span>
          </div>`
      : '';

    const discountRow = discount > 0
      ? `<tr>
            <td colspan="4" style="padding: 8px; text-align: right; color: #059669; font-size: 14px;">Remise appliquée :</td>
            <td style="padding: 8px; text-align: right; color: #059669; font-size: 14px; font-weight: 600;">-${formatCurrency(discount, currency)}</td>
          </tr>`
      : '';

    // Function to get action message based on order type
    function getReadyActionMessage(orderType: string): string {
      switch (orderType) {
        case 'eat-in':
          return '<div style="background: #dcfce7; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 16px 0;"><strong style="color: #166534;">Votre table vous attend !</strong><br><span style="color: #15803d;">Rendez-vous au restaurant pour déguster votre commande.</span></div>';
        case 'take-away':
          return '<div style="background: #dcfce7; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 16px 0;"><strong style="color: #166534;">Prêt à emporter !</strong><br><span style="color: #15803d;">Votre commande vous attend au comptoir.</span></div>';
        case 'delivery':
          return '<div style="background: #dcfce7; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 16px 0;"><strong style="color: #166534;">En cours de livraison !</strong><br><span style="color: #15803d;">Votre commande arrive chez vous.</span></div>';
        default:
          return '<div style="background: #dcfce7; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 16px 0;"><strong style="color: #166534;">Commande prête !</strong><br><span style="color: #15803d;">Venez récupérer votre commande.</span></div>';
      }
    }

    // Build vendor address string
    const vendorAddress = vendorInfo?.address
      ? `${vendorInfo.address.street || ''}, ${vendorInfo.address.postalCode || ''} ${vendorInfo.address.city || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '')
      : '';

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

          <!-- Ticket Container -->
          <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">

            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">${emailTitle}</h1>
              <p style="margin: 0; font-size: 14px; opacity: 0.9;">Commande #${orderDetails.orderNumber}</p>
            </div>

            <!-- Greeting -->
            <div style="padding: 24px; border-bottom: 1px dashed #e5e7eb;">
              <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">${emailGreeting.replace(/\n/g, '<br>')}</p>
              ${actionMessage}
            </div>

            <!-- Restaurant Info Section -->
            <div style="padding: 20px 24px; background: #f9fafb; border-bottom: 1px dashed #e5e7eb;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Émis par</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${vendorInfo?.businessName || 'Restaurant'}</p>
              ${vendorAddress ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #4b5563; line-height: 1.5;">${vendorAddress}</p>` : ''}
              ${vendorInfo?.siret ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">SIRET: ${vendorInfo.siret}</p>` : ''}
              ${vendorInfo?.tvaNumber ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #6b7280;">N° TVA: ${vendorInfo.tvaNumber}</p>` : ''}
            </div>

            <!-- Order Info Section -->
            <div style="padding: 20px 24px; border-bottom: 1px dashed #e5e7eb;">
              <div style="display: table; width: 100%;">
                <div style="display: table-cell; width: 50%; padding: 8px 0;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">Date et heure</p>
                  <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 500; color: #111827;">${formatDateTime(orderDateTime)}</p>
                </div>
                <div style="display: table-cell; width: 50%; padding: 8px 0;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">Type de commande</p>
                  <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 500; color: #111827;">${getOrderTypeLabel(orderDetails.orderType)}</p>
                </div>
              </div>
              <div style="display: table; width: 100%; margin-top: 8px;">
                <div style="display: table-cell; width: 50%; padding: 8px 0;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">Moyen de paiement</p>
                  <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 500; color: #111827;">${paymentMethod}</p>
                </div>
                <div style="display: table-cell; width: 50%; padding: 8px 0;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">Client</p>
                  <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 500; color: #111827;">${customerName}</p>
                </div>
              </div>
              ${scheduledTimeSection}
              ${notesSection}
            </div>

            <!-- Items Table -->
            <div style="padding: 20px 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Détail des articles</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Article</th>
                    <th style="padding: 12px 8px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">P.U.</th>
                    <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Qté</th>
                    <th style="padding: 12px 8px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">TVA</th>
                    <th style="padding: 12px 8px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <!-- Totals Section -->
            <div style="padding: 0 24px 24px 24px;">
              <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px;">
                <tbody>
                  ${discountRow}
                  <tr>
                    <td colspan="4" style="padding: 12px 16px; text-align: right; font-size: 14px; color: #4b5563;">Total HT :</td>
                    <td style="padding: 12px 16px; text-align: right; font-size: 14px; color: #111827;">${formatCurrency(taxBreakdown.ht, currency)}</td>
                  </tr>
                  <tr>
                    <td colspan="4" style="padding: 8px 16px; text-align: right; font-size: 14px; color: #4b5563;">TVA (${VAT_RATE_FOOD}%) :</td>
                    <td style="padding: 8px 16px; text-align: right; font-size: 14px; color: #111827;">${formatCurrency(taxBreakdown.tva, currency)}</td>
                  </tr>
                  <tr style="background: #2563eb;">
                    <td colspan="4" style="padding: 16px; text-align: right; font-size: 16px; font-weight: 700; color: #ffffff; border-radius: 0 0 0 8px;">TOTAL TTC :</td>
                    <td style="padding: 16px; text-align: right; font-size: 18px; font-weight: 700; color: #ffffff; border-radius: 0 0 8px 0;">${formatCurrency(taxBreakdown.ttc, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Tracking Button -->
            ${trackingButton}

            <!-- Footer -->
            <div style="padding: 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Merci pour votre confiance !</p>
              ${vendorInfo?.contact?.email ? `
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                Pour toute question, contactez-nous à<br>
                <a href="mailto:${vendorInfo.contact.email}" style="color: #2563eb; text-decoration: none;">${vendorInfo.contact.email}</a>
              </p>
              ` : ''}
              ${vendorInfo?.contact?.phone ? `
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
                Tél: ${vendorInfo.contact.phone}
              </p>
              ` : ''}
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  ${vendorInfo?.businessName || 'Restaurant'}${vendorAddress ? ` - ${vendorAddress}` : ''}<br>
                  ${vendorInfo?.siret ? `SIRET: ${vendorInfo.siret}` : ''}${vendorInfo?.siret && vendorInfo?.tvaNumber ? ' | ' : ''}${vendorInfo?.tvaNumber ? `N° TVA: ${vendorInfo.tvaNumber}` : ''}
                </p>
              </div>
            </div>

          </div>

        </div>
      </body>
      </html>
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
