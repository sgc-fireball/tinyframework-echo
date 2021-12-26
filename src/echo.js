const cors = require('cors');
const express = require('express');
const uuid = require('uuid').v4;
const utils = require('./utils');
const config = require('./config');

const app = express();
const sessions = {};

app.set('trust proxy', config.trusted || 'loopback');
app.use(cors());
require('express-ws')(app);

module.exports = function () {

    app.ws('/broadcast/websocket', async function (ws, req) {
        const cookies = {};
        req.headers.cookie.split('; ').forEach((line) => {
            let [name, value] = line.split('=', 2);
            cookies[name] = value;
        });
        const sessionId = cookies.session || null;
        if (!sessionId) {
            throw new Error('Invalid session');
        }
        sessions[sessionId] = sessions[sessionId] || {
            channels: ['system'],
            connections: {},
        };
        const connectionId = uuid();
        console.log('[+] S:', sessionId.substr(0, 8), 'C:', connectionId.substr(0, 8));
        sessions[sessionId].connections[connectionId] = {
            channels: ['system'],
            ws: ws
        };

        ws.on('message', async (msg) => {
            const message = {type: 'unknown', ...JSON.parse(msg)};

            if (message.type === 'ping') {
                console.log('[P] S:', sessionId.substr(0, 8), 'C:', connectionId.substr(0, 8));
                ws.send(JSON.stringify({type: 'pong', pong: message.ping}));
            } else if (message.type === 'subscribe') {
                if (sessions[sessionId].channels.indexOf(message.channel) !== -1) {
                    console.warn('[C+] S:', sessionId.substr(0, 8), 'C:', connectionId.substr(0, 8), 'CH:', message.channel);
                    sessions[sessionId].connections[connectionId].channels.push(message.channel);
                    sessions[sessionId].connections[connectionId].channels = sessions[sessionId].connections[connectionId].channels
                        .filter((channel, index, self) => { // uniq
                            return self.indexOf(channel) === index && channel;
                        });
                    ws.send(JSON.stringify({type: 'subscribed', channel: message.channel}));
                } else {
                    utils
                        .requestJSON(
                            'POST',
                            (config.app_url || req.headers.origin || 'https://' + req.headers.host) + '/broadcast/auth',
                            {channel: message.channel},
                            {'Cookie': req.headers.cookie}
                        )
                        .then((response) => {
                            console.warn('[C+] S:', sessionId.substr(0, 8), 'C:', connectionId.substr(0, 8), 'CH:', message.channel);
                            sessions[sessionId].connections[connectionId].channels.push(message.channel);
                            sessions[sessionId].connections[connectionId].channels = sessions[sessionId].connections[connectionId].channels
                                .filter((channel, index, self) => { // uniq
                                    return self.indexOf(channel) === index && channel;
                                });
                            sessions[sessionId].channels.push(message.channel);
                            sessions[sessionId].channels = sessions[sessionId].channels
                                .filter((channel, index, self) => { // uniq
                                    return self.indexOf(channel) === index && channel;
                                });
                            ws.send(JSON.stringify({type: 'subscribed', channel: message.channel}));
                        })
                        .catch((e) => {
                            console.warn('[C-] S:', sessionId.substr(0, 8), 'C:', connectionId.substr(0, 8), 'CH:', message.channel);
                        });
                }
            } else if (message.type === 'unsubscribe') {
                console.log('[U] S:', sessionId.substr(0, 8), 'C:', connectionId.substr(0, 8));
                const channels = message.channels || [];
                sessions[sessionId].connections[connectionId].channels = sessions[sessionId].connections[connectionId]
                    .channels.filter((channel) => {
                        return !channels.indexOf(channel);
                    });
                ws.send(JSON.stringify({
                    type: 'unsubscribed',
                    channels: sessions[sessionId].connections[connectionId].channels
                }));
            }
        });

        ws.on('close', (e) => {
            console.log('[-] S:', sessionId.substr(0, 8), 'C:', connectionId.substr(0, 8));
            if (!!sessions[sessionId].connections[connectionId]) {
                delete sessions[sessionId].connections[connectionId];
            }
        });

    });

    return {
        broadcast: (channel, payload) => {
            console.log('[M] CH:', channel);
            let message = JSON.stringify({
                type: 'broadcast',
                channel: channel,
                payload: payload
            });
            Object.values(sessions).forEach((session) => {
                Object.values(session.connections).forEach((connection) => {
                    if (connection.channels.indexOf(channel) === -1) {
                        return;
                    }
                    connection.ws.send(message);
                });
            });
        },
        server: app.listen(config.port, config.host, () => {
            console.log('Listening on port http://' + config.host + ':' + config.port + ' ...');
        })
    };
};
