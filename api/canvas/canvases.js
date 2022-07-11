import axios from 'axios';
import requestCanvases from './_canvasApi.js';

/**
 * Adds canvas URLs to tracks.
 * 
 * @param {object} tracks 
 * @returns {object}
 */
export default async function getCanvases(tracks) {
  let canvases = [];  // Response array.
  let canvasToken = getCanvasToken();
  
  // Remove duplicates from tracks.
  let uniqueUris = [];
  let uniqueTrackItems = [];
  tracks.forEach((track, i) => {
    if (!uniqueUris.includes(track.uri)) {
      uniqueTrackItems.push({track});
      uniqueUris.push(track.uri);
    }
  });

  let canvasResponse = await requestCanvases(uniqueTrackItems, await canvasToken);
  if (canvasResponse.canvasesList) {
    // Build canvas mapping.
    let canvasMap = new Map();
    for (const track of canvasResponse.canvasesList) {
      if (track.trackUri && track.canvasUrl) {
        canvasMap.set(track.trackUri, track.canvasUrl);
      }
    }

    // Response is in random order so sort by track input order.
    for (const item of uniqueTrackItems) {
      if (canvasMap.has(item.track.uri)) {
        item.track.canvas_url = canvasMap.get(item.track.uri);
      }
      canvases.push(item.track);
    }
  }
  
  return canvases;
}

/**
 * @returns {string}
 */
function getCanvasToken() {
  const CANVAS_TOKEN_URL = 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player';
  return axios.get(CANVAS_TOKEN_URL)
    .then((response) => {
      if (response.statusText !== 'OK') {
        console.log(`ERROR ${CANVAS_TOKEN_URL}: ${response.status} ${response.statusText}`);
        if (response.data.error) {
          console.log(response.data.error);
        }
      } else {
        return response.data.accessToken;
      }
    })
    .catch((error) => console.log(`ERROR ${CANVAS_TOKEN_URL}: ${error}`));
}
