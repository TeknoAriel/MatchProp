/**
 * Web Speech API types (Chrome, Edge, Safari).
 * Not in default TypeScript lib.dom.
 */
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface Window {
  SpeechRecognition?: new () => globalThis.SpeechRecognition;
  webkitSpeechRecognition?: new () => globalThis.SpeechRecognition;
}
