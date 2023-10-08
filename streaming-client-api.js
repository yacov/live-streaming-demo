'use strict';
import { DID_API, config } from './helpers/apiConfig.js';
import { 
  talkVideo, 
  peerStatusLabel, 
  iceStatusLabel, 
  iceGatheringStatusLabel, 
  signalingStatusLabel, 
  streamingStatusLabel, 
  connectButton, 
  destroyButton, 
  micButton, 
  userInputField 
} from './helpers/domElements.js';
import VoiceflowAPI from './helpers/voiceflowAPI.js';
import DIDAPI from './helpers/didAPI.js';
import SpeechRecognition from './helpers/speechRecognition.js';
import UIInteraction from './helpers/uiInteraction.js';
import VideoPlayer from './helpers/videoPlayer.js';
import RetryHelper from './helpers/retryHelper.js';

let selectedConfig;
const retryHelper = new RetryHelper();



if (DID_API.key == '🤫') alert('Please put your api key inside ./api.json and restart..');

const RTCPeerConnection = (
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection
).bind(window);

let peerConnection;
let streamId = null; // Initialize streamId
let sessionId = null;
let sessionClientAnswer;

let statsIntervalId;
let videoIsPlaying;
let lastBytesReceived;
const didAPI = new DIDAPI(DID_API.key, streamId, sessionId);

talkVideo.setAttribute('playsinline', '');

connectButton.onclick = async () => {
  const languageSelection = document.querySelector('input[name="language"]:checked').value;
  const avatarSelection = document.querySelector('input[name="avatar"]:checked').value;

  selectedConfig = {
    ...config.avatar[avatarSelection],
    ...config.language[languageSelection],
    voice_id: config.language[languageSelection].voice_id[avatarSelection]
  };

  if (peerConnection && peerConnection.connectionState === 'connected') {
    return;
  }

  stopAllStreams();
  closePC();

  const sessionResponse = await retryHelper.fetchWithRetries(`${DID_API.url}/talks/streams`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${DID_API.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_url: selectedConfig.source_url,
      config: { stitch: true }
    })
  });

  const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json();
  streamId = newStreamId;
  sessionId = newSessionId;
  didAPI.setStreamId(streamId);
didAPI.setSessionId(sessionId);

  try {
    sessionClientAnswer = await createPeerConnection(offer, iceServers);
  } catch (e) {
    console.log('error during streaming setup', e);
    stopAllStreams();
    closePC();
    return;
  }

  const sdpResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${DID_API.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      answer: sessionClientAnswer,
      session_id: sessionId
    })
  });
};

const languageSelection = document.querySelector('input[name="language"]:checked').value;
const avatarSelection = document.querySelector('input[name="avatar"]:checked').value;

 selectedConfig = {
  ...config.avatar[avatarSelection],
  ...config.language[languageSelection],
  voice_id: config.language[languageSelection].voice_id[avatarSelection]
};
async function sendQuestionToVoiceflow(question) {
  const voiceflowResponse = await fetch('https://general-runtime.voiceflow.com/knowledge-base/query', {
    method: 'POST',
    headers: {
      'Authorization': `${selectedConfig.authorizationKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      question: question,
      settings: {
        model: 'gpt-3.5-turbo',
        temperature: 0.1
      }
    })
  });

  const voiceflowData = await voiceflowResponse.json();
  const answer = voiceflowData.output || selectedConfig.noInformationMessage;
  console.log('Answer: ' + answer);
  return answer;
}

userInputField.addEventListener('keydown', async function(event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent form submission

    const question = userInputField.value.trim();
    if (question) {
      userInputField.value = '';
      // Send question to Voiceflow API
      const answer = await sendQuestionToVoiceflow(question);
      didAPI.sendAnswer(answer, selectedConfig);
    }
  }
});
const speechRecognition = new SpeechRecognition(selectedConfig);
micButton.onclick = () => {
  userInputField.disabled = true;
  speechRecognition.startRecognition();
  const languageSelection = document.querySelector('input[name="language"]:checked').value;
  const avatarSelection = document.querySelector('input[name="avatar"]:checked').value;
  selectedConfig = {
    ...config.avatar[avatarSelection],
    ...config.language[languageSelection],
    voice_id: config.language[languageSelection].voice_id[avatarSelection]
  };
  
  micButton.classList.add('recording');
 

  speechRecognition.onresult = async function(event) {
    const speechResult = event.results[0][0].transcript;
    console.log('Result: ' + speechResult);
   
    userInputField.value = speechResult;
    // Pass the transcribed text to the Voiceflow API
    const answer = await sendQuestionToVoiceflow(question);
    didAPI.sendAnswer(answer, selectedConfig);
    
  };

  speechRecognition.onspeechend = function() {
    speechRecognition.stopRecognition();
    micButton.classList.remove('recording');
    userInputField.disabled = false;
  };

  speechRecognition.onerror = function(event) {
    console.log('Error occurred in recognition: ' + event.error);
    micButton.classList.remove('recording');
  };
};

destroyButton.onclick = async () => {
  await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Basic ${DID_API.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ session_id: sessionId })
  });

  stopAllStreams();
  closePC();
};

function onIceGatheringStateChange() {
  iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
  iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}

function onIceCandidate(event) {
  console.log('onIceCandidate', event);
  if (event.candidate) {
    const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

    fetch(`${DID_API.url}/talks/streams/${streamId}/ice`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        candidate,
        sdpMid,
        sdpMLineIndex,
        session_id: sessionId
      })
    });
  }
}

function onIceConnectionStateChange() {
  iceStatusLabel.innerText = peerConnection.iceConnectionState;
  iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
  if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
    stopAllStreams();
    closePC();
  }
}

function onConnectionStateChange() {
  // not supported in firefox
  peerStatusLabel.innerText = peerConnection.connectionState;
  peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}

function onSignalingStateChange() {
  signalingStatusLabel.innerText = peerConnection.signalingState;
  signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}

function onVideoStatusChange(videoIsPlaying, stream) {
  let status;
  if (videoIsPlaying) {
    status = 'streaming';
    const remoteStream = stream;
    setVideoElement(remoteStream);
  } else {
    status = 'empty';
    playIdleVideo();
  }
  streamingStatusLabel.innerText = status;
  streamingStatusLabel.className = 'streamingState-' + status;
}

function onTrack(event) {
  /**
   * The following code is designed to provide information about wether currently there is data
   * that's being streamed - It does so by periodically looking for changes in total stream data size
   *
   * This information in our case is used in order to show idle video while no talk is streaming.
   * To create this idle video use the POST https://api.d-id.com/talks endpoint with a silent audio file or a text script with only ssml breaks
   * https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html#break-tag
   * for seamless results use `config.fluent: true` and provide the same configuration as the streaming video
   */

  if (!event.track) return;

  statsIntervalId = setInterval(async () => {
    const stats = await peerConnection.getStats(event.track);
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        const videoStatusChanged = videoIsPlaying !== report.bytesReceived > lastBytesReceived;

        if (videoStatusChanged) {
          videoIsPlaying = report.bytesReceived > lastBytesReceived;
          onVideoStatusChange(videoIsPlaying, event.streams[0]);
        }
        lastBytesReceived = report.bytesReceived;
      }
    });
  }, 500);
}

async function createPeerConnection(offer, iceServers) {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection({ iceServers });
    peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    peerConnection.addEventListener('icecandidate', onIceCandidate, true);
    peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
    peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
    peerConnection.addEventListener('track', onTrack, true);
  }

  await peerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');

  const sessionClientAnswer = await peerConnection.createAnswer();
  console.log('create local sdp OK');

  await peerConnection.setLocalDescription(sessionClientAnswer);
  console.log('set local sdp OK');

  return sessionClientAnswer;
}

function setVideoElement(stream) {
  if (!stream) return;
  talkVideo.srcObject = stream;
  talkVideo.loop = false;

  // safari hotfix
  if (talkVideo.paused) {
    talkVideo
      .play()
      .then((_) => {
      })
      .catch((e) => {
      });
  }
}

function playIdleVideo() {
  talkVideo.srcObject = undefined;
  talkVideo.src = selectedConfig.idleVideo;
  talkVideo.loop = true;
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    console.log('stopping video streams');
    talkVideo.srcObject.getTracks().forEach((track) => track.stop());
    talkVideo.srcObject = null;
  }
}

function closePC(pc = peerConnection) {
  if (!pc) return;
  console.log('stopping peer connection');
  pc.close();
  pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
  pc.removeEventListener('icecandidate', onIceCandidate, true);
  pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
  pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
  pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
  pc.removeEventListener('track', onTrack, true);
  clearInterval(statsIntervalId);
  iceGatheringStatusLabel.innerText = '';
  signalingStatusLabel.innerText = '';
  iceStatusLabel.innerText = '';
  peerStatusLabel.innerText = '';
  console.log('stopped peer connection');
  if (pc === peerConnection) {
    peerConnection = null;
  }
}

