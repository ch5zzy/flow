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

  var scope = 'user-read-recently-played';

  //redirect to spotify login with desired scope
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

  // Fetch the Spotify access token.
  fetch('https://accounts.spotify.com/api/token', options)
    .then((response) => {
      if (response && response.ok) {
        response.json().then((data) => {
          res.redirect('/?' + stringify({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          }));
        });
      }
    })
    .catch((error) => console.log(error));
});

app.get('/spotify-reauth', (req, res) => {
  var refreshToken = req.query.refresh_token || null;

  var body = {
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  var options = {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${new Buffer.from(`${clientId}:${clientSecret}`)
        .toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: stringify(body),
  };

  fetch('https://accounts.spotify.com/api/token', options)
    .then((response) => {
      if (response && response.ok) {
        response.json().then((data) => {
          res.send({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
        });
      }
    })
    .catch((error) => console.log(error));
});

app.get('/', (req, res) => {
  res.redirect('/me?' + stringify(req.query));
});

app.get('/me', (req, res) => {
  const accessToken = req.query.access_token;
  if (!accessToken) {
    res.redirect('/spotify-auth?' + stringify(req.query));
    return;
  }

  res.sendFile(getAbsolutePath('public/html/index.html'));
});

app.get('/recent-tracks', (req, res) => {
  const accessToken = req.query.access_token;
  if (!accessToken) {
    res.send({});
    return;
  }

  getRecentlyPlayed(accessToken).then((recentTracks) => {
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
})

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
