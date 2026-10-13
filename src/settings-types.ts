export interface Settings {
  personality: string;
  language: string;
  voiceEnabled: boolean;
  voice: string;
  engine: "apple" | "elevenlabs";
  elevenVoice: string;
  personaVoices: Record<string, string>;
  elevenVoiceName: string;
  elevenModel: string;
  soundEffects: boolean;
  rate: number;
  volume: number;
  lowBattery: number;
  criticalBattery: number;
  quietEnabled: boolean;
  quietStart: number;
  quietEnd: number;
  disabledEvents: string[];
}
