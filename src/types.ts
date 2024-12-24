export interface Message {
  content: string;
}

export interface ChatSession {
  id: string;
  timestamp: string;
  messages: Message[];
}

export interface ModelConfig {
  name: string;
  systemPrompt: string;
  apiKey: string;
}
