import RetryHelper from './retryHelper.js';
class DIDAPI {
    constructor(apiKey, streamId, sessionId) {
      this.apiKey = apiKey;
      this.streamId = streamId;
      this.sessionId = sessionId;
      this.retryHelper = new RetryHelper();
    }
  
    async sendAnswer(answer, selectedConfig) {
        const talkResponse = await this.retryHelper.fetchWithRetries(`https://api.d-id.com/talks/streams/${this.streamId}`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${this.apiKey}`,
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
              auto_match: true,
              normalization_factor: 1,
              sharpen:true,
              stitch: true,
            },
            session_id: this.sessionId
          })
        });
      }
      setStreamId(streamId) {
        this.streamId = streamId;
      }
    
      setSessionId(sessionId) {
        this.sessionId = sessionId;
      }
  }
  
  export default DIDAPI;