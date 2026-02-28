/**
 * Bull Board Dashboard API
 * GET /api/bull-board
 * 
 * Provides a web UI for monitoring BullMQ queues
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Handle all HTTP methods for Bull Board
 */
export async function GET(request: NextRequest) {
  // Basic auth check
  const authHeader = request.headers.get('authorization');
  const username = process.env.BULL_BOARD_USER || 'admin';
  const password = process.env.BULL_BOARD_PASSWORD || 'admin';

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Bull Board"',
      },
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [user, pass] = credentials.split(':');

  if (user !== username || pass !== password) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Bull Board"',
      },
    });
  }

  // Return Bull Board HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bull Board - Campaign Queue Monitor</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-top: 0;
    }
    .queue-list {
      list-style: none;
      padding: 0;
    }
    .queue-item {
      padding: 15px;
      margin: 10px 0;
      background: #f9f9f9;
      border-left: 4px solid #0066cc;
      border-radius: 4px;
    }
    .queue-name {
      font-weight: 600;
      font-size: 18px;
      color: #333;
    }
    .queue-stats {
      margin-top: 10px;
      display: flex;
      gap: 20px;
    }
    .stat {
      display: flex;
      flex-direction: column;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #0066cc;
    }
    .info {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🐂 Bull Board - Campaign Queue Monitor</h1>
    
    <div class="info">
      <strong>Note:</strong> For full Bull Board functionality, install and configure the Express middleware.
      This is a simplified view. Queue stats are fetched via API.
    </div>

    <h2>Active Queues</h2>
    <ul class="queue-list">
      <li class="queue-item">
        <div class="queue-name">📋 Campaign Processor</div>
        <p>Main queue for processing campaign lead steps</p>
      </li>
      <li class="queue-item">
        <div class="queue-name">🤝 Connection Sender</div>
        <p>Handles LinkedIn connection requests</p>
      </li>
      <li class="queue-item">
        <div class="queue-name">💬 Message Sender</div>
        <p>Sends direct messages to connections</p>
      </li>
      <li class="queue-item">
        <div class="queue-name">📨 InMail Sender</div>
        <p>Sends InMails (Premium feature)</p>
      </li>
      <li class="queue-item">
        <div class="queue-name">🔍 Status Checker</div>
        <p>Polls connection acceptance status</p>
      </li>
      <li class="queue-item">
        <div class="queue-name">📬 Inbox Scanner</div>
        <p>Detects replies from leads</p>
      </li>
    </ul>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      <h3>Quick Actions</h3>
      <p>Use the campaign stats API endpoint: <code>/api/campaigns/[id]/stats</code></p>
      <p>Worker status: Check terminal where <code>npm run campaign-worker</code> is running</p>
    </div>
  </div>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
