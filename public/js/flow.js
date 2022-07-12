import Cookie from './cookie.js';

var refreshToken = Cookie.get('refresh_token');
checkTokens();

var tracksList = document.querySelector("#track-container");
var audio = new Audio();

fetchTracks(createTrackElements);

/**
 * Checks validity of access tokens.
 */
function checkTokens() {
    let params = new URLSearchParams(document.location.search);
    if (!refreshToken || params.get('refresh_token')) {
        refreshToken = params.get('refresh_token');

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

function createTrackElements(tracks) {
    for (const track of tracks) {
        const canvasUrl = track.canvas_url;
        const trackArt = track.art;

        const container = document.createElement('div');
        container.classList.add('track');

        let trackElem;
        if (canvasUrl) {
            trackElem = document.createElement('video');
            trackElem.src = track.canvas_url;
            trackElem.autoplay = true;
            trackElem.muted = true;
            trackElem.loop = true;
            trackElem.playsInline = true;

            container.onmouseenter = (event) => {
                const aspect = trackElem.videoWidth / trackElem.videoHeight;
                const newWidth = window.innerHeight * aspect;
                container.style.flex = '0 0 ' + newWidth + 'px';
            }
        } else {
            trackElem = document.createElement('img');
            trackElem.src = track.art;

            container.onmouseenter = (event) => {
                const aspect = trackElem.naturalWidth / trackElem.naturalHeight;
                const newWidth = window.innerHeight * aspect;
                container.style.flex = '0 0 ' + newWidth + 'px';
            }
        }

        container.onmouseleave = (event) => {
            container.style.flex = '0 0 100px';
        }

        container.onclick = (event) => {
            audio.pause();
            audio.src = track.preview_url;
            audio.play();
        };

        container.append(trackElem);
        tracksList.append(container);
    }
}