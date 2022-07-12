import Cookie from './cookie.js';

// Check if there is a refresh token stored.
var refreshToken = Cookie.get('refresh_token');
checkTokens();

// Create the track list and audio object.
var tracksList = document.querySelector("#track-container");
var audio = new Audio();
// Fetch the user's recent tracks.
fetchTracks(createTrackElements);

/**
 * Checks validity of access tokens.
 */
function checkTokens() {
    let params = new URLSearchParams(document.location.search);
    const newRefreshToken = params.get('refresh_token');
    if (!refreshToken || newRefreshToken) {
        refreshToken = newRefreshToken;
        if (!refreshToken) {
            window.location.replace('/');
        } else {
            Cookie.set('refresh_token', refreshToken);
            window.location.replace('/me');
        }
    }
}

/**
 * Fetch recently played tracks.
 * 
 * @param {function} callback
 */
async function fetchTracks(callback) {
    fetch('/recent-tracks?refresh_token=' + refreshToken)
        .then((response) => {
            if (response && response.status == 200) {
                response.json().then((tracks) => {
                    if (tracks.error) {
                        window.location.replace('/');
                    }

                    callback(tracks)
                });
            }
        });
}

/**
 * Populate the track list with track elements.
 * 
 * @param {Array<object>} tracks
 */
function createTrackElements(tracks) {
    for (const track of tracks) {
        // Get the track canvas and artwork.
        const canvasUrl = track.canvas_url;
        const trackArt = track.art;
        
        // Create a container for holding the track art.
        const trackElem = document.createElement('div');
        trackElem.classList.add('track');

        let trackVis;
        if (canvasUrl) {
            // Canvas is available, so track art will be a video.
            trackVis = document.createElement('video');
            trackVis.src = track.canvas_url;
            trackVis.autoplay = true;
            trackVis.muted = true;
            trackVis.loop = true;
            trackVis.playsInline = true;

            // Expand the track when hovered.
            trackElem.onmouseenter = (event) => {
                const aspect = trackVis.videoWidth / trackVis.videoHeight;
                const newWidth = window.innerHeight * aspect;
                trackElem.style.flex = '0 0 ' + newWidth + 'px';
            }
        } else {
            // No canvas, so track art will be an image.
            trackVis = document.createElement('img');
            trackVis.src = track.art;
            
            // Expand the track when hovered.
            trackElem.onmouseenter = (event) => {
                const aspect = trackVis.naturalWidth / trackVis.naturalHeight;
                const newWidth = window.innerHeight * aspect;
                trackElem.style.flex = '0 0 ' + newWidth + 'px';
            }
        }

        // Close the track when not hovered.
        trackElem.onmouseleave = (event) => {
            trackElem.style.flex = '0 0 100px';
        }

        // Play the track sample when clicked.
        trackElem.onclick = (event) => {
            audio.pause();
            audio.src = track.preview_url;
            audio.play();
        };

        trackElem.append(trackVis);
        tracksList.append(trackElem);
    }
}