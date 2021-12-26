const env = (process || {}).env || {}

module.exports = {
    app_url: env.APP_URL || null,
    host: env.HOST || '0.0.0.0',
    port: env.PORT || 6000,
    trusted: env.TRUSTED || 'loopback'
};
