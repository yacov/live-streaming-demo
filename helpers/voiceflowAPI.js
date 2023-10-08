class VoiceflowAPI {
    constructor(authorizationKey) {
      this.authorizationKey = authorizationKey;
    }
    async sendQuestion(question) {
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
    }
    export default VoiceflowAPI;