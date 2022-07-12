import axios from 'axios';
import express from 'express';
import fetch from 'node-fetch';
import uniqid from 'uniqid';
import path from 'path';
import getCanvases from './api/canvas/canvases.js';

var clientId = process.env.SPOTIFY_CLIENT_ID;
var clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
var redirectUri = process.env.SPOTIFY_CALLBACK_URI;
var state;

var app = express();

/**
 * Stringifies URL parameters.
 * 
 * @param {object} data 
 * @returns {string}
 */
function stringify(data) {
  return (new URLSearchParams(data)).toString();
}

/**
 * Get the absolute path to a file.
 * 
 * @param {string} file 
 * @returns {string}
 */
function getAbsolutePath(file) {
  return path.join(path.resolve(), file);
}

app.get('/spotify-auth', (req, res) => {
  // Create state string for validation
  state = uniqid('flow-spotify-');

  // If a refresh token is provided, use it to get a new token.
  if (req.query.refreshToken) {
    res.redirect('/spotify-reauth?' + stringify(req.query));
    return;
  }

  // Redirect to spotify login with desired scope.
  var scope = 'user-read-recently-played';
  res.redirect('https://accounts.spotify.com/authorize?' +
    stringify({
      response_type: 'code',
      client_id: clientId,
      scope: scope,
      redirect_uri: redirectUri,
      state: state,
    }));
});

app.get('/spotify-callback', (req, res) => {
  var code = req.query.code || null;
  var reqState = req.query.state || null;

  // Ensure state strings match.
  if (reqState === null || reqState != state) {
    res.redirect('/#' +
      stringify({
        error: 'state_mismatch',
      }));
  }

  var body = {
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };
  var options = {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${new Buffer.from(`${clientId}:${clientSecret}`)
        .toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stringify(body),
  };

  // Fetch the Spotify refresh token.
  fetch('https://accounts.spotify.com/api/token', options)
    .then((response) => {
      if (response && response.ok) {
        response.json().then((data) => {
          res.redirect('/?' + stringify({
            refresh_token: data.refresh_token,
          }));
        });
      }
    })
    .catch((error) => console.log(error));
});

app.get('/', (req, res) => {
  if (!req.query.refresh_token) {
    res.redirect('/spotify-auth');
    return;
  }

  res.redirect('/me?' + stringify(req.query));
});

app.get('/me', (req, res) => {
  res.sendFile(getAbsolutePath('public/html/index.html'));
});

app.get('/recent-tracks', (req, res) => {
  const refreshToken = req.query.refresh_token;
  if (!refreshToken) {
    res.send({});
    return;
  }

  getAccessToken(refreshToken).then((accessToken) => {
    getRecentlyPlayed(accessToken).then((recentTracks) => {
      if (!recentTracks) {
        res.send({
          error: -1,
        });
        return;
      }

      getCanvases(recentTracks.items.map((trackItem) => trackItem.track))
        .then((tracks) => {
          res.send(tracks.map((track) => {
            return {
              name: track.name,
              album: track.album.name,
              artists: track.artists.map((artist) => artist.name),
              art: track.album.images[0].url,
              preview_url: track.preview_url,
              canvas_url: track.canvas_url,
              link: track.external_urls.spotify,
            };
          }));
        });
    });
  });
})

function getAccessToken(refreshToken) {
  const ACCESS_TOKEN_URL = 'https://accounts.spotify.com/api/token';

  const body = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }
  const options = {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }

  return axios.post(ACCESS_TOKEN_URL, stringify(body), options)
    .then(response => {
      if (response.statusText !== 'OK') {
        console.log(`ERROR ${ACCESS_TOKEN_URL}: ${response.status} ${response.statusText}`);
        if (response.data.error) {
          console.log(response.data.error);
        }
      } else {
        return response.data.access_token;
      }
    })
    .catch(error => console.log(`ERROR ${ACCESS_TOKEN_URL}: ${error}`));
}

function getRecentlyPlayed(accessToken) {
  const RECENTLY_PLAYED_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=50';

  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  return axios.get(RECENTLY_PLAYED_URL, options)
    .then((response) => {
      if (response.statusText !== 'OK') {
        console.log(`ERROR ${RECENTLY_PLAYED_URL}: ${response.status} ${response.statusText}`);
        if (response.data.error) {
          console.log(response.data.error);
        }
      } else {
        return response.data;
      }
    })
    .catch((error) => console.log(`ERROR ${RECENTLY_PLAYED_URL}: ${error}`));
}

app.use(express.static('public'));

const port = process.env.PORT || 8888;
var server = app.listen(port, '0.0.0.0', () => {
  console.log('Running on ' + server.address().address + ':' + port);
});
