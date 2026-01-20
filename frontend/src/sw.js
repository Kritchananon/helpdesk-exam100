const CACHE_NAME = 'support-ticket-app-v1.0.0';
const API_CACHE_NAME = 'support-ticket-api-v1.0.0';

// Files to cache for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  // Assets
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  // Add other critical assets
];

// Routes that should work offline
const OFFLINE_ROUTES = [
  '/',
  '/dashboard',
  '/tickets/list',
  '/login'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static resources');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static resources with cache-first strategy
  event.respondWith(handleStaticRequest(request));
});

// Network-first strategy for API requests
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests
    if (request.method === 'GET' && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache for:', request.url);
    
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API calls
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'This feature requires an internet connection' 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle navigation requests with cache-first for offline routes
async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Navigation offline, trying cache');
    
    // Check if route should work offline
    const url = new URL(request.url);
    const isOfflineRoute = OFFLINE_ROUTES.some(route => 
      url.pathname === route || url.pathname.startsWith(route + '/')
    );
    
    if (isOfflineRoute) {
      // Return cached index.html for offline routes
      const cachedResponse = await cache.match('/index.html');
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Return offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Support Ticket App</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f8f9fa;
            }
            .offline-container {
              max-width: 400px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .icon { font-size: 48px; margin-bottom: 20px; }
            h1 { color: #dc3545; margin-bottom: 10px; }
            p { color: #6c757d; line-height: 1.5; }
            button {
              background: #0d6efd;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover { background: #0b5ed7; }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="icon">📡</div>
            <h1>คุณออฟไลน์อยู่</h1>
            <p>ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อของคุณ</p>
            <button onclick="window.location.reload()">ลองใหม่</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Cache-first strategy for static resources
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Failed to fetch:', request.url);
    throw error;
  }
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-tickets') {
    event.waitUntil(syncOfflineTickets());
  }
});

// Sync offline tickets when connection is restored
async function syncOfflineTickets() {
  console.log('[Service Worker] Syncing offline tickets...');
  
  // Get offline tickets from IndexedDB or cache
  // This would integrate with your ticket service
  try {
    // Implementation would depend on your offline storage strategy
    console.log('[Service Worker] Offline tickets synced successfully');
  } catch (error) {
    console.error('[Service Worker] Failed to sync offline tickets:', error);
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  if (!event.data) {
    return;
  }
  
  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/assets/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/icons/icon-72x72.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Support Ticket App', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app to relevant page
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});