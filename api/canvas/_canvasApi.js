import axios from 'axios';
import canvas from './_canvas_pb.cjs';

const CANVASES_URL = 'https://spclient.wg.spotify.com/canvaz-cache/v0/canvases';

/**
 * Gets the canvases for a list of tracks.
 * 
 * @param {object} tracks 
 * @param {string} accessToken 
 * @returns {object}
 */
export default function requestCanvases(tracks, accessToken) {
  // Build canvas request protobuf.
  let canvasRequest = new canvas.CanvasRequest();
  for (const track of tracks) {
    let spotifyTrack = new canvas.CanvasRequest.Track();
    spotifyTrack.setTrackUri(track.track.uri);
    canvasRequest.addTracks(spotifyTrack);
  }
  let requestBytes = canvasRequest.serializeBinary();

  const options = {
    responseType: 'arraybuffer',
    headers: {
      'accept': 'application/protobuf',
      'content-type': 'application/x-www-form-urlencoded',
      'accept-language': 'en',
      'user-agent': 'Spotify/8.5.49 iOS/Version 13.3.1 (Build 17D50)',
      'accept-encoding': 'gzip, deflate, br',
      'authorization': `Bearer ${accessToken}`,
    }
  }

  return axios.post(CANVASES_URL, requestBytes, options)
    .then((response) => {
      if (response.statusText !== 'OK') {
        console.log(`ERROR ${CANVASES_URL}: ${response.status} ${response.statusText}`);
        if (response.data.error) {
          console.log(response.data.error);
        }
      } else {
        return canvas.CanvasResponse.deserializeBinary(response.data).toObject();
      }
    })
    .catch((error) => console.log(`ERROR ${CANVASES_URL}: ${error}`));
}
