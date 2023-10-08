class DIDAPI {
    constructor(apiKey, streamId, sessionId) {
      this.apiKey = apiKey;
      this.streamId = streamId;
      this.sessionId = sessionId;
    }
  
    async sendAnswer(answer) {
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
              ssml: false,
              input: answer // Use the answer from Voiceflow
            },
            driver_url: 'bank://lively/',
            config: {
              fluent: false,
              pad_audio: 0.2,
              align_driver: false,
              auto_match: false,
              normalization_factor: 1,
              sharpen:true,
            },
            session_id: sessionId
          })
        });
      }
  }
  
  export default DIDAPI;