class SpeechRecognition {
  constructor(selectedConfig) {
    this.selectedConfig = selectedConfig;
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
    this.recognition.lang = this.selectedConfig.recognitionLang;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
  }

  startRecognition() {
    this.recognition.start();
  }

  stopRecognition() {
    this.recognition.stop();
  }

  onResult(callback) {
    this.recognition.onresult = callback;
  }

  onError(callback) {
    this.recognition.onerror = callback;
  }

  onSpeechEnd(callback) {
    this.recognition.onspeechend = callback;
  }
}

export default SpeechRecognition;