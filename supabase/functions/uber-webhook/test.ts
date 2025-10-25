// Test script for Uber Eats webhook
// Run with: deno run --allow-net test.ts

const WEBHOOK_URL =
  'http://localhost:54321/functions/v1/uber-webhook/test-vendor-123/deliveryupdates';

// Sample webhook payload based on Uber documentation
const sampleDeliveryStatusWebhook = {
  account_id: 'acc_test123',
  batch_id: 'bat_voEiX66nUf-D4XzKRlpJLQ',
  created: '2023-08-01T06:28:22.695Z',
  customer_id: 'fb109f30-d2f0-5447-a0fa-884a44394axx',
  data: {
    batch_id: 'bat_voEiX66nUf-D4XzKRlpJLQ',
    complete: true,
    courier: {
      img_href: 'https://d1w2poirtb3as9.cloudfront.net/default.jpeg',
      location: {
        lat: 40.724533,
        lng: -74.00839,
      },
      name: 'Sam',
      phone_number: '+15555555557',
      rating: '5.00',
      vehicle_type: 'car',
    },
    courier_imminent: false,
    created: '2023-08-01T06:26:13.896Z',
    currency: 'usd',
    deliverable_action: 'deliverable_action_meet_at_door',
    dropoff: {
      address: '231 Hudson St, New York, NY 10013',
      location: {
        lat: 40.724533,
        lng: -74.00839,
      },
      name: 'DROPOFF T.',
      phone_number: '+15555555556',
      status: 'completed',
      status_timestamp: '2023-08-01T06:28:22.564Z',
    },
    dropoff_eta: '2023-08-01T06:28:22.564Z',
    fee: 9200,
    id: 'del_QbLowiwHQM-b4e8YmOZNOw',
    kind: 'delivery',
    live_mode: false,
    pickup: {
      address: '175 Greenwich St, New York, NY 10007',
      location: {
        lat: 40.71093,
        lng: -74.0119,
      },
      name: 'Coffee Shop',
      phone_number: '+15555555555',
      status: 'completed',
      status_timestamp: '2023-08-01T06:27:04.748Z',
    },
    status: 'delivered',
    tracking_url:
      'https://www.ubereats.com/tw/orders/41b2e8c2-2c07-40cf-9be1-ef1898e64d3b',
    updated: '2023-08-01T06:28:22.611Z',
    uuid: '41B2E8C22C0740CF9BE1EF1898E64D3B',
  },
  delivery_id: 'del_QbLowiwHQM-b4e8YmOZNOw',
  developer_id: 'dev_test123',
  id: 'evt_Bouz7BhPTYGDz9FFQNgODw',
  kind: 'event.delivery_status',
  live_mode: false,
  status: 'delivered',
};

async function testWebhook() {
  console.log('Testing Uber webhook with sample payload...');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleDeliveryStatusWebhook),
    });

    const result = await response.json();

    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed');
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Test different status scenarios
async function testStatusTransitions() {
  const statuses = [
    { status: 'pending', imminent: false, expected: 'created' },
    { status: 'pickup', imminent: false, expected: 'en_route_to_pickup' },
    { status: 'pickup', imminent: true, expected: 'arrived_at_pickup' },
    { status: 'pickup_complete', imminent: false, expected: 'in_transit' },
    { status: 'dropoff', imminent: false, expected: 'en_route_to_dropoff' },
    { status: 'dropoff', imminent: true, expected: 'arrived_at_dropoff' },
    { status: 'delivered', imminent: false, expected: 'delivered' },
    { status: 'canceled', imminent: false, expected: 'cancelled' },
  ];

  for (const test of statuses) {
    console.log(
      `\n🧪 Testing ${test.status} (imminent: ${test.imminent}) -> ${test.expected}`
    );

    const payload = {
      ...sampleDeliveryStatusWebhook,
      status: test.status,
      data: {
        ...sampleDeliveryStatusWebhook.data,
        status: test.status,
        courier_imminent: test.imminent,
      },
      id: `evt_test_${Date.now()}`, // Unique event ID
    };

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log(
        `   Status: ${response.status}, Result:`,
        result.ok ? '✅' : '❌',
        result
      );
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }
}

if (import.meta.main) {
  await testWebhook();
  console.log('\n' + '='.repeat(50));
  await testStatusTransitions();
}
