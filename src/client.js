class Broadcast {

    constructor() {
        this.ws = null;
        this._resolve = null;
        this.pws = new Promise((resolve) => {
            this._resolve = resolve;
        });
        this.errorCount = 0;
        this.ping = 0;
        this.pingPongInterval = null;
        this.channels = [];
        this.connect();
        this.callback = (channel, payload) => {
            console.log('Broadcast[', channel, ']', payload);
        };
    }

    on(callback) {
        this.callback = callback;
        return this;
    }

    connect() {
        if (!!this.pingPongInterval) {
            clearInterval(this.pingPongInterval);
            this.pingPongInterval = null;
        }
        this.ping = 0;
        this.ws = new WebSocket(window.location.origin.replace('http', 'ws') + '/broadcast/websocket');
        this.ws.addEventListener('open', (e) => this._onOpen(e));
        this.ws.addEventListener('message', (e) => this._onMessage(e));
        this.ws.addEventListener('close', (e) => this._onClose(e));
        this.ws.addEventListener('error', (e) => this._onError(e));
        return this.pws;
    }

    _resetPing() {
        if (!!this.pingPongInterval) {
            clearInterval(this.pingPongInterval);
            this.pingPongInterval = null;
        }
        this.pingPongInterval = setInterval(() => {
            this.ping = Date.now();
            this.ws.send(JSON.stringify({
                type: 'ping',
                ping: this.ping
            }));
        }, 25 * 1000); // 25 seconds
    }

    _onOpen(e) {
        console.log('Broadcast::connected');
        this.errorCount = 0;
        this._resetPing();
        if (this.channels.length) {
            const channels = this.channels;
            this.channels = [];
            channels.forEach((channel) => {
                this.subscribe(channel)
            });
        }
        this._resolve(this.ws);
    }

    _onMessage(e) {
        const message = {type: 'unknown', ...JSON.parse(e.data)};
        if (message.type === 'pong') {
            if (this.ping > 0) {
                const pong = parseInt((message || {}).pong || 0);
                if (pong === this.ping) {
                    let rtt = Date.now() - pong;
                    this.ping = 0;
                    console.log('Broadcast::rtt:', rtt / 1000, 'sec.');
                }
            }
        } else if (message.type === 'subscribed') {
            this.channels.push(message.channel);
        } else if (message.type === 'unsubscribed') {
            this.channels = this.channels.filter((channel) => channel !== message.channels);
        }
        this._resetPing();
        this.callback(message.channel || 'unknown', message.payload || null);
    }

    _onClose(e) {
        this.errorCount++;
        const timeToWait = Math.min(60, Math.pow(this.errorCount, 2) * 0.5);
        console.log('Broadcast::disconnected - start reconnect in', timeToWait, 'seconds.');
        this.pws = new Promise((resolve) => {
            this._resolve = resolve;
        });
        if (!!this.pingPongInterval) {
            clearInterval(this.pingPongInterval);
            this.pingPongInterval = null;
            this.ping = 0;
        }
        this.ws = null;
        setTimeout(() => {
            this.connect();
        }, timeToWait * 1000);
    }

    _onError(e) {
        console.warn('Broadcast::error:', e);
    }

    subscribe(channel) {
        this.pws.then(() => {
            console.log('Broadcast::subscribe:', channel);
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                channel: channel
            }));
            this._resetPing();

        });
    }

    unsubscribe(channel) {
        this.pws.then(() => {
            console.log('Broadcast::unsubscribe:', channel);
            this.ws.send(JSON.stringify({
                type: 'unsubscribe',
                channel: channel
            }));
            this._resetPing();
        });
    }

}

module.exports = new Broadcast();
