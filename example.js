require('dotenv').config();

const {server, broadcast} = require('./src/echo')();

const stopping = () => {
    console.warn("\nSignal received. Stopping ...");
    server.close();
    process.exit(0);
};

setInterval(() => {
    broadcast('system', {'time': date.getTime()});
}, 5000);

process.on('SIGHUP', stopping); // 1 - Temrinal closed
process.on('SIGINT', stopping); // 2 - CRTL-C
process.on('SIGQUIT', stopping); // 3 - Terminal disconnected
process.on('SIGTERM', stopping); // 15 - kill <pid>
