'use strict';
import DID_API from './api.json' assert { type: 'json' };
const spinner = document.getElementById('spinner');
let selectedConfig;
if (DID_API.key == '🤫') alert('Please put your api key inside ./api.json and restart..');

const RTCPeerConnection = (
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection
).bind(window);

let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;

let statsIntervalId;
let videoIsPlaying;
let lastBytesReceived;
const config = {
  avatar: {
    man: {
      source_url: 's3://d-id-images-prod/google-oauth2|112587076384125082124/img_3GEAo5oqRZM1iJ9wxZIWi/PresenterManFinal1.png',
      idleVideo: 'M_Idle.mp4'
    },
    woman: {
      source_url: 's3://d-id-images-prod/google-oauth2|112587076384125082124/img_-sAMwA3KEaT7RL-WbWr4i/PresenterWomanFinal1.png',
      idleVideo: 'W_idle.mp4'
    }
  },
  language: {
    'en-US': {
      recognitionLang: 'en-US',
      authorizationKey: DID_API.vs_en_key,
      noInformationMessage: 'Sorry, I don\'t have this information',
      voice_id: {
        man: 'en-US-ChristopherNeural',
        woman: 'en-US-JennyNeural'
      }
    },
    'ar': {
      recognitionLang: 'ar',
      authorizationKey: DID_API.vs_ar_key,
      noInformationMessage: 'آسف، ليس لدي هذه المعلومات',
      voice_id: {
        man: 'ar-AE-HamdanNeural',
        woman: 'ar-AE-FatimaNeural'
      }
    }
  }
};

const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');
const streamingStatusLabel = document.getElementById('streaming-status-label');

const connectButton = document.getElementById('connect-button');
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

  const sessionResponse = await fetchWithRetries(`${DID_API.url}/talks/streams`, {
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
const userInputField = document.getElementById('user-input-field');

 selectedConfig = {
  ...config.avatar[avatarSelection],
  ...config.language[languageSelection],
  voice_id: config.language[languageSelection].voice_id[avatarSelection]
};
async function sendQuestionToVoiceflow(question) {
  document.getElementById('spinner').style.display = 'block';
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
async function sendAnswerToDID(answer) {
  const talkResponse = await fetchWithRetries(`${DID_API.url}/talks/streams/${streamId}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${DID_API.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      script: {
        type: 'text',
        subtitles: 'false',
        provider: { type: 'microsoft', voice_id: selectedConfig.voice_id },
        ssml: true,
        input: answer // Use the answer from Voiceflow
      },
      driver_url: 'bank://lively/',
      config: {
        sharpen: false,
        stitch: true
      },
      session_id: sessionId
    })
  });
}

userInputField.addEventListener('keydown', async function(event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent form submission

    const question = userInputField.value.trim();
    if (question) {
      userInputField.value = '';
      // Send question to Voiceflow API
      const answer = await sendQuestionToVoiceflow(question);
      sendAnswerToDID(answer);
    }
  }
});

const micButton = document.getElementById('mic-button');
micButton.onclick = () => {
  userInputField.disabled = true;
  const languageSelection = document.querySelector('input[name="language"]:checked').value;
  const avatarSelection = document.querySelector('input[name="avatar"]:checked').value;
  selectedConfig = {
    ...config.avatar[avatarSelection],
    ...config.language[languageSelection],
    voice_id: config.language[languageSelection].voice_id[avatarSelection]
  };
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
  recognition.lang = selectedConfig.recognitionLang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  micButton.classList.add('recording');
  recognition.start();

  recognition.onresult = async function(event) {
    const speechResult = event.results[0][0].transcript;
    console.log('Result: ' + speechResult);
   
    userInputField.value = speechResult;
    // Pass the transcribed text to the Voiceflow API
    const answer = await sendQuestionToVoiceflow(speechResult);
    sendAnswerToDID(answer);
    
  };

  recognition.onspeechend = function() {
    recognition.stop();
    micButton.classList.remove('recording');
    userInputField.disabled = false;
  };

  recognition.onerror = function(event) {
    console.log('Error occurred in recognition: ' + event.error);
    micButton.classList.remove('recording');
  };
};

const destroyButton = document.getElementById('destroy-button');
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
    document.getElementById('spinner').style.display = 'none';
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

const maxRetryCount = 3;
const maxDelaySec = 4;

async function fetchWithRetries(url, options, retries = 1) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries <= maxRetryCount) {
      const delay = Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) * 1000;

      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(`Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`);
      return fetchWithRetries(url, options, retries + 1);
    } else {
      throw new Error(`Max retries exceeded. error: ${err}`);
    }
  }
}
