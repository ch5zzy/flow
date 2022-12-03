import Cookie from './cookie.js';

const appUrl = window.location.origin;
const baseUrl = window.location.origin + window.location.pathname;

var style = getComputedStyle(document.body);

// Create the track list and audio object.
var tracksList = document.querySelector("#track-container");
const trackPeekScale = 3;
const trackPeekWidth = parseInt(style.getPropertyValue('--initial-track-width')) * trackPeekScale;
var audio = new Audio();

// Attach click handler to share button.
var shareButton = document.querySelector('#share-button');
shareButton.onclick = shareButtonHandler;

// Check if there is a refresh token stored.
var refreshToken = Cookie.get('refresh_token');
var trackIds;
var serializedTracks;
checkTokens();

// Fetch the user's recent tracks.
if (!serializedTracks) {
    fetchRecentTracks(createTrackElements);
} else {
    fetchTracks(trackIds, createTrackElements);
}

// Attach event listeners for drag handling.
var mouseDown = false;
var didScroll = false;
var startX, scrollLeft;
var startDragging = function (event) {
    mouseDown = true;
    startX = event.pageX - tracksList.offsetLeft;
    scrollLeft = tracksList.scrollLeft;
    didScroll = false;
};
var stopDragging = function (event) {
    mouseDown = false;
};
tracksList.addEventListener('mousemove', (event) => {
    event.preventDefault();

    if (!mouseDown) {
        return;
    }

    didScroll = true;
    const x = event.pageX - tracksList.offsetLeft;
    const scroll = x - startX;
    tracksList.scrollLeft = scrollLeft - scroll;
});
tracksList.addEventListener('mousedown', startDragging, false);
tracksList.addEventListener('mouseup', stopDragging, false);
tracksList.addEventListener('mouseleave', stopDragging, false);

/**
 * Handles clicks for the share button.
 */
function shareButtonHandler() {
    serializedTracks = encodeURIComponent(JSON.stringify(trackIds));

    fetch('/display-name?refresh_token=' + refreshToken)
        .then((response) => {
            if (response && response.status == 200) {
                response.json().then((profile) => {
                    // If there was an error, reauthenticate.
                    if (profile.error) {
                        window.location.replace('/');
                    }

                    const shareUrl = `${appUrl}/you?n=${profile.display_name}&t=${serializedTracks}`;
                    
                    fetch('/shorten?url=' + encodeURIComponent(shareUrl))
                        .then((response) => {
                            if (response && response.status == 200) {
                                response.json().then((short) => {
                                    writeToClipboard(short.short_url, () => {
                                        shareButton.innerHTML = 'copied to clipboard!'
                                        setInterval(() => {
                                            shareButton.innerHTML = 'share my flow';
                                        }, 5000);
                                    }, () => {
                                        shareButton.innerHTML = short.short_url;
                                        setInterval(() => {
                                            shareButton.innerHTML = 'share my flow';
                                        }, 10000);
                                    });
                                });
                            }
                        });
                });
            }
        });
}

/**
 * Checks validity of access tokens.
 */
function checkTokens() {
    let params = new URLSearchParams(document.location.search);

    // Check if there are serialized tracks in the URL.
    serializedTracks = params.get('t');
    if (serializedTracks) {
        disableShareButton((params.get('n') ?? 'someone') + '\'s flow');
        trackIds = JSON.parse(serializedTracks);
        return;
    }

    const newRefreshToken = params.get('refresh_token');
    if (!refreshToken || newRefreshToken) {
        refreshToken = newRefreshToken;
        if (!refreshToken) {
            window.location.replace('/spotify-auth');
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
async function fetchRecentTracks(callback) {
    fetch('/recent-tracks?refresh_token=' + refreshToken)
        .then((response) => {
            if (response && response.status == 200) {
                response.json().then((tracks) => {
                    // If there was an error, reauthenticate.
                    if (tracks.error) {
                        window.location.replace('/');
                    }

                    trackIds = tracks.map((track) => track.id);
                    callback(tracks);
                });
            }
        });
}

/**
 * Fetch recently played tracks.
 * 
 * @param {Array<string>} trackIds
 * @param {function} callback
 */
async function fetchTracks(trackIds, callback) {
    fetch('/get-tracks?ids=' + encodeURIComponent(JSON.stringify(trackIds)))
        .then((response) => {
            if (response && response.status == 200) {
                response.json().then((tracks) => {
                    // If there was an error, reauthenticate.
                    if (tracks.error) {
                        window.location.replace('/');
                    }

                    callback(tracks);
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
        const trackAnnotation = `${track.name} - ${track.artists.join(', ')}`;
        trackElem.setAttribute('aria-label', trackAnnotation);
        trackElem.setAttribute('title', trackAnnotation);
        trackElem.setAttribute('tabindex', 0);

        let trackVis;
        let expandTrack;
        trackElem.isFullyExpanded = false;
        if (canvasUrl) {
            // Canvas is available, so track art will be a video.
            trackVis = document.createElement('video');
            trackVis.src = canvasUrl;
            trackVis.autoplay = true;
            trackVis.muted = true;
            trackVis.loop = true;
            trackVis.playsInline = true;
            trackVis.setAttribute('tabindex', -1);

            expandTrack = (peek=false) => {
                const aspect = trackVis.videoWidth / trackVis.videoHeight;
                const newWidth = peek ? trackPeekWidth : window.innerHeight * aspect;
                trackElem.style.flex = '0 0 ' + newWidth + 'px';
                trackElem.isFullyExpanded = !peek;
            };
        } else {
            // No canvas, so track art will be an image.
            trackVis = document.createElement('img');
            trackVis.src = trackArt;
            trackVis.draggable = false;
            trackVis.setAttribute('tabindex', -1);

            expandTrack = (peek=false) => {
                const aspect = trackVis.naturalWidth / trackVis.naturalHeight;
                const newWidth = peek ? trackPeekWidth : window.innerHeight * aspect;
                trackElem.style.flex = '0 0 ' + newWidth + 'px';
                trackElem.isFullyExpanded = !peek;
            };
        }

        // Expand the track when hovered.
        trackElem.onmouseenter = (event) => {
            if (!trackElem.isFullyExpanded) {
                expandTrack(true);
            }
        }
        trackElem.addEventListener('focus', (event) => {
            event.preventDefault();
            trackElem.onmouseenter(event);
        });

        // Close the track when not hovered.
        let closeTrack = (event, force=false) => {
            if (document.activeElement !== event.target && (!trackElem.isFullyExpanded || force)) {
                trackElem.style.flex = '0 0 var(--initial-track-width)';
                if (force) {
                    trackElem.isFullyExpanded = false;
                }
            }
        };
        trackElem.onmouseleave = closeTrack;
        trackElem.addEventListener('blur', (event) => {
            event.preventDefault();
            trackElem.onmouseleave(event);
        });

        // Expand the track and play the track sample when clicked.
        trackElem.onclick = (event) => {
            if (!didScroll) {
                expandTrack();
                audio.pause();
                audio.src = track.preview_url;
                audio.play();
                // Close track when sample finishes or another track is selected.
                audio.onended = () => {
                    closeTrack(event, true);
                };
                audio.pause = audio.onended;
            }
        };
        trackElem.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                trackElem.click();
            }
        });

        trackElem.append(trackVis);
        tracksList.append(trackElem);
    }
}

/**
 * Writes some text to the clipboard.
 * 
 * @param {string} text 
 * @param {function} onSuccess 
 * @param {function} onFailure 
 */
function writeToClipboard(text, onSuccess, onFailure) {
    navigator.clipboard.writeText(text).then(onSuccess, onFailure);
}

/**
 * Disables the share button and replaces the text with given value.
 * 
 * @param {string} newText
 */
function disableShareButton(newText) {
    shareButton.onclick = () => { };
    shareButton.classList.add('shareDisabled');
    shareButton.innerHTML = newText;
}