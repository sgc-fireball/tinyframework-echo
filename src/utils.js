const http = require('http');
const https = require('https');

module.exports = {
    getParameterByURL(req, variable) {
        const query = req.url.indexOf('?') === -1 ? '' : req.url.substr(req.url.indexOf('?'));
        const vars = query.split('&');
        for (let i = 0; i < vars.length; i++) {
            let pair = vars[i].split('=');
            if (decodeURIComponent(pair[0]) === variable) {
                return decodeURIComponent(pair[1]);
            }
        }
        return null;
    },

    requestJSON(method, url, object = {}, header = {}) {
        let body = JSON.stringify(object);
        header['Accept'] = 'application/json;q=0.9,*/*;q=0.8';
        header['Content-Type'] = 'application/json; charset=utf-8';
        if (method.indexOf('GET', 'OPTIONS', 'HEAD') !== -1) {
            body = null;
        } else {
            header['Content-Length'] = Buffer.byteLength(body, 'utf-8');
        }
        return this.request(method, url, body, header)
            .then((body) => {
                return !!body ? JSON.parse(body) : {};
            })
    },

    request(method, url, body = null, headers = {}) {
        const uri = new URL(url);
        return new Promise((resolve, reject) => {
            const options = {
                method: method,
                protocol: uri.protocol || 'https:',
                hostname: uri.hostname,
                port: (uri.port || (uri.protocol === 'http:' ? 80 : 443)),
                path: uri.pathname + (uri.search || ''),
                headers: headers
            };
            const protocol = uri.protocol === 'https:' ? https : http;
            const request = protocol.request(options, (response) => {
                let chunks = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    chunks += chunk;
                });
                response.on('end', () => {
                    response.statusCode >= 200 && response.statusCode <= 299 ? resolve(chunks) : reject(chunks);
                });
            });
            request.on('error', reject);
            if (!!body && ['OPTIONS', 'HEAD', 'GET'].indexOf(method) === -1) {
                request.write(body);
            }
            request.end();
        });
    }
};
