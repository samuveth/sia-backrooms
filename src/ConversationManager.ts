import { Bot } from "grammy";
import { ChatSession, Message, ModelConfig } from "./types";
import { DatabaseService } from "./services/DatabaseService";

const TELEGRAM_GROUP_ID = -1002341709610;
const DELAY_BETWEEN_RESPONSES = 300000;

const MODEL_1 = "anthropic/claude-3-opus";
const MODEL_2 = "meta-llama/llama-3.3-70b-instruct";
export class ConversationManager {
  private model1: ModelConfig;
  private model2: ModelConfig;
  private bot: Bot;
  private db: DatabaseService;

  constructor(model1: ModelConfig, model2: ModelConfig) {
    this.model1 = model1;
    this.model2 = model2;
    this.bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
    this.db = new DatabaseService();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendToTelegram(
    message: string,
    pin: boolean = false
  ): Promise<void> {
    try {
      const sentMessage = await this.bot.api.sendMessage(
        TELEGRAM_GROUP_ID,
        message
      );
      if (pin) {
        await this.bot.api.pinChatMessage(
          TELEGRAM_GROUP_ID,
          sentMessage.message_id
        );
      }
    } catch (error) {
      console.error("Error sending to Telegram:", error);
    }
  }

  private async saveSession(session: ChatSession): Promise<void> {
    await this.db.saveSession(session);
  }

  public async loadSession(sessionId: string): Promise<ChatSession | null> {
    return await this.db.loadSession(sessionId);
  }

  private async fetchModelResponse(
    model: ModelConfig,
    messages: Message[],
    otherModelName: string
  ): Promise<string> {
    try {
      // Prepare messages for the current model's perspective
      const contextMessages = messages.map((msg) => {
        if (msg.content.startsWith(`[${otherModelName}]:\n\n`)) {
          // Other model's messages become assistant messages
          return {
            role: "user",
            content: msg.content.replace(`[${otherModelName}]:\n\n`, ""),
          };
        } else {
          // Current model's previous messages become user messages
          return {
            role: "assistant",
            content: msg.content.replace(`[${model.name}]:\n\n`, ""),
          };
        }
      });

      const body = JSON.stringify({
        model: `${model.name === "Alan Watts" ? MODEL_1 : MODEL_2}`,
        temperature: 1,
        messages: [
          { role: "system", content: model.systemPrompt },
          ...contextMessages,
        ],
      });

      const response = await fetch(
        "https://api.red-pill.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${model.apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.statusText}\nResponse: ${errorText}`
        );
      }

      const data = await response.json();

      if (!data?.choices?.[0]?.message?.content) {
        throw new Error(
          `Invalid API response format. Received: ${JSON.stringify(data)}`
        );
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error("Error in API call:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
      return `[Error] Failed to get response from ${model.name}. Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
    }
  }

  public async startNewSession(initialMessage: string): Promise<ChatSession> {
    const timestamp = new Date().toISOString();
    const session: ChatSession = {
      id: timestamp.replace(/[:.]/g, "-"),
      timestamp,
      messages: [
        {
          content: `[${this.model2.name}]:\n\n${initialMessage}`,
        },
      ],
    };

    await this.saveSession(session);
    await this.sendToTelegram(
      `Session ID: ${session.id}\n\nTopic: ${initialMessage}`,
      true // Pin this message
    );
    return session;
  }

  public async startNewSessionFromPrevious(
    previousSessionId: string
  ): Promise<ChatSession> {
    const previousSession = await this.loadSession(previousSessionId);
    if (!previousSession) {
      throw new Error(`Previous session ${previousSessionId} not found`);
    }

    const timestamp = new Date().toISOString();
    const session: ChatSession = {
      id: timestamp.replace(/[:.]/g, "-"),
      timestamp,
      messages: [...previousSession.messages],
    };

    await this.saveSession(session);
    await this.sendToTelegram(
      `Session ID: ${session.id}\nContinued from: ${previousSessionId}\n\n`,
      true // Pin this message
    );
    return session;
  }

  public async continueConversation(
    sessionId: string,
    turns: number
  ): Promise<ChatSession> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Remove last message if it was from Model 1 (who goes first)
    const lastMessage = session.messages[session.messages.length - 1];
    if (
      lastMessage &&
      lastMessage.content.startsWith(`[${this.model1.name}]:\n\n`)
    ) {
      session.messages.pop();
      await this.saveSession(session);
    }

    for (let i = 0; i < turns; i++) {
      // Model 1's turn
      const model1Response = await this.fetchModelResponse(
        this.model1,
        session.messages,
        this.model2.name
      );
      const model1Message = `[${this.model1.name}]:\n\n${model1Response}`;
      session.messages.push({ content: model1Message });
      await this.saveSession(session);
      await this.sendToTelegram(model1Message);

      // Wait before the next turn
      await this.delay(DELAY_BETWEEN_RESPONSES);

      // Model 2's turn
      const model2Response = await this.fetchModelResponse(
        this.model2,
        session.messages,
        this.model1.name
      );
      const model2Message = `[${this.model2.name}]:\n\n${model2Response}`;
      session.messages.push({ content: model2Message });
      await this.saveSession(session);
      await this.sendToTelegram(model2Message);

      // Wait before the next turn
      if (i < turns - 1) {
        await this.delay(DELAY_BETWEEN_RESPONSES);
      }
    }

    return session;
  }
}
