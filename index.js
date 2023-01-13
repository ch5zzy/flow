import axios from 'axios';
import express from 'express';
import fetch from 'node-fetch';
import uniqid from 'uniqid';
import path from 'path';
import tinyUrl from 'tinyurl';
import getCanvases from './api/canvas/canvases.js';
import * as dotenv from 'dotenv';

dotenv.config();

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

/**
 * Authorize app for use with Spotify account.
 */
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

/**
 * Spotify callback.
 */
app.get('/spotify-callback', (req, res) => {
  var code = req.query.code || null;
  var reqState = req.query.state || null;

  // Ensure state strings match.
  if (reqState === null || reqState != state) {
    res.redirect('/#' +
      stringify({
        error: 'state_mismatch',
      }));
    return;
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

/**
 * Checks if refresh token is available and if not, requests authorization.
 */
app.get('/', (req, res) => {
  if (!req.query.refresh_token) {
    res.redirect('/login');
    return;
  }

  res.redirect('/me?' + stringify(req.query));
});

/**
 * Displays the user's recent tracks.
 */
app.get('/me', (req, res) => {
  res.sendFile(getAbsolutePath('public/html/index.html'));
});

/**
 * Displays another user's recent tracks.
 */
app.get('/you', (req, res) => {
  if (!req.query.t) {
    res.redirect('/');
    return;
  }

  res.sendFile(getAbsolutePath('public/html/index.html'));
});

/**
 * Gets a user's recent tracks.
 */
app.get('/recent-tracks', (req, res) => {
  const refreshToken = req.query.refresh_token;
  if (!refreshToken) {
    res.send({});
    return;
  }

  getPersonalToken(refreshToken).then((accessToken) => {
    getRecentlyPlayed(accessToken).then((recentTracks) => {
      // If there is an error getting the tracks, send an error to client.
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
              id: track.id,
            };
          }));
        });
    });
  });
});

/**
 * Gets tracks for the given IDs.
 */
app.get('/get-tracks', (req, res) => {
  const trackIds = req.query.ids;
  if (!trackIds) {
    res.send({});
    return;
  }

  getAccessToken().then((accessToken) => {
    getTracks(JSON.parse(trackIds), accessToken).then((bareTracks) => {
      if (!bareTracks) {
        res.send({
          error: -1,
        });
        return;
      }

      getCanvases(bareTracks)
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
              id: track.id,
            };
          }));
        });
    });
  });
});

/**
 * Gets a user's display name.
 */
app.get('/display-name', (req, res) => {
  const refreshToken = req.query.refresh_token;
  if (!refreshToken) {
    res.send({});
    return;
  }

  getPersonalToken(refreshToken).then((accessToken) => {
    getUserProfile(accessToken).then((profile) => {
      if (!profile) {
        res.send({
          error: -1,
        });
        return;
      }

      res.send({
        display_name: profile.display_name,
      });
    })
  });
});

app.get('/login', (req, res) => {
  res.sendFile(getAbsolutePath('public/html/login.html'));
});

/**
 * Shortens a URL.
 */
app.get('/shorten', (req, res) => {
  const longUrl = req.query.url;
  if (!longUrl) {
    res.send({});
    return;
  }

  tinyUrl.shorten(longUrl, (shortUrl, error) => {
    if (error) {
      console.log(error);
      return;
    }

    res.send({
      short_url: shortUrl,
    });
  });
})

/**
 * Gets a new personal token using a refresh token.
 * 
 * @param {string} refreshToken 
 * @returns {string}
 */
function getPersonalToken(refreshToken) {
  const PERSONAL_TOKEN_URL = 'https://accounts.spotify.com/api/token';

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

  return axios.post(PERSONAL_TOKEN_URL, stringify(body), options)
    .then(response => {
      if (response.statusText !== 'OK') {
        console.log(`ERROR ${PERSONAL_TOKEN_URL}: ${response.status} ${response.statusText}`);
        if (response.data.error) {
          console.log(response.data.error);
        }
      } else {
        return response.data.access_token;
      }
    })
    .catch(error => console.log(`ERROR ${PERSONAL_TOKEN_URL}: ${error}`));
}

/**
 * Gets a new access token.
 */
function getAccessToken() {
  const ACCESS_TOKEN_URL = 'https://accounts.spotify.com/api/token';

  const body = {
    grant_type: 'client_credentials',
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
    .catch(error => console.log(`ERROR ${PERSONAL_TOKEN_URL}: ${error}`));
}

/**
 * Gets a user's recently played tracks.
 * 
 * @param {*} accessToken 
 * @returns {object}
 */
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

/**
 * @param {Array<string>} trackIds 
 * @param {string} accessToken
 * @returns 
 */
function getTracks(trackIds, accessToken) {
  const TRACKS_URL = 'https://api.spotify.com/v1/tracks?market=US&ids=' + trackIds.join(',');

  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  return axios.get(TRACKS_URL, options)
    .then((response) => {
      if (response.statusText !== 'OK') {
        console.log(`ERROR ${TRACKS_URL}: ${response.status} ${response.statusText}`);
        if (response.data.error) {
          console.log(response.data.error);
        }
      } else {
        return response.data.tracks;
      }
    })
    .catch((error) => console.log(`ERROR ${TRACKS_URL}: ${error}`));
}

/**
 * Gets a user's profile.
 * 
 * @param {*} accessToken 
 * @returns {object}
 */
function getUserProfile(accessToken) {
  const USER_PROFILE_URL = 'https://api.spotify.com/v1/me';

  const options = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  return axios.get(USER_PROFILE_URL, options)
    .then((response) => {
      if (response.statusText !== 'OK') {
        console.log(`ERROR ${USER_PROFILE_URL}: ${response.status} ${response.statusText}`);
        if (response.data.error) {
          console.log(response.data.error);
        }
      } else {
        return response.data;
      }
    })
    .catch((error) => console.log(`ERROR ${USER_PROFILE_URL}: ${error}`));
}

app.use(express.static('public'));

const port = process.env.PORT || 8888;
var server = app.listen(port, '0.0.0.0', () => {
  console.log('Running on ' + server.address().address + ':' + port);
});
