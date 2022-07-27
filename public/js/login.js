import Cookie from './cookie.js';

var refreshToken = Cookie.get('refresh_token');
if (refreshToken) {
    window.location.replace('/me');
}