import { genId } from './utils';

export type GatewayEventHandler = (event: string, payload: any) => void;
export type GatewayResponseHandler = (id: string, ok: boolean, payload: any) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private eventHandlers: GatewayEventHandler[] = [];
  private _onStatus: (s: 'disconnected' | 'connecting' | 'connected') => void = () => {};
  private reconnectTimer: any = null;
  private connected = false;
  private autoReconnect = true;

  private wsUrl: string;
  private authToken: string;

  constructor(wsUrl?: string, authToken?: string) {
    this.wsUrl = wsUrl || `ws://${window.location.hostname}:18789`;
    this.authToken = authToken || '';
  }

  /** Update credentials (e.g. after login). Does not reconnect automatically. */
  setCredentials(wsUrl: string, authToken: string) {
    this.wsUrl = wsUrl;
    this.authToken = authToken;
  }

  onStatus(fn: (s: 'disconnected' | 'connecting' | 'connected') => void) {
    this._onStatus = fn;
  }

  onEvent(fn: GatewayEventHandler) {
    this.eventHandlers.push(fn);
    return () => { this.eventHandlers = this.eventHandlers.filter(h => h !== fn); };
  }

  connect() {
    if (this.ws) return;
    this.autoReconnect = true;
    this._onStatus('connecting');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => { console.log('[GW] WS open'); };

    this.ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { console.log('[GW] parse error', ev.data); return; }
      console.log('[GW] msg:', msg.type, msg.event || msg.id || '', msg.ok);

      if (msg.type === 'event') {
        if (msg.event === 'connect.challenge') {
          this.handleChallenge();
        } else {
          for (const h of this.eventHandlers) h(msg.event, msg.payload);
        }
      } else if (msg.type === 'res') {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          if (msg.ok) pending.resolve(msg.payload);
          else pending.reject(msg.payload || msg.error);
        }
      }
    };

    this.ws.onclose = (ev) => {
      console.log('[GW] WS close:', ev.code, ev.reason);
      this.ws = null;
      this.connected = false;
      this._onStatus('disconnected');
      this.pendingRequests.forEach(p => p.reject(new Error('disconnected')));
      this.pendingRequests.clear();
      if (this.autoReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = (e) => { console.log('[GW] WS error', e); };
  }

  private handleChallenge() {
    const id = genId('connect');
    this.request(id, 'connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: { id: 'webchat', version: '1.0.0', platform: 'web', mode: 'webchat' },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      caps: [],
      commands: [],
      permissions: {},
      auth: { token: this.authToken },
      locale: navigator.language || 'en',
      userAgent: 'pinchchat/1.0.0',
    }).then((res) => {
      console.log('[GW] connected!', res);
      this.connected = true;
      this._onStatus('connected');
    }).catch((err) => {
      console.log('[GW] connect failed:', err);
      this.autoReconnect = false;
      this.disconnect();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  disconnect() {
    this.autoReconnect = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this._onStatus('disconnected');
  }

  request(id: string, method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('not connected'));
      }
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: 'req', id, method, params }));
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('timeout'));
        }
      }, 30000);
    });
  }

  async send(method: string, params: any): Promise<any> {
    const id = genId('req');
    return this.request(id, method, params);
  }

  get isConnected() { return this.connected; }
}
