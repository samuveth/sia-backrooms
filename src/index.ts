import { config } from "dotenv";
import { ConversationManager } from "./ConversationManager";
import { ModelConfig } from "./types";

// Load environment variables from .env file
config();

async function main() {
  // Configure the two models
  const alanWatts: ModelConfig = {
    name: "Alan Watts",
    systemPrompt:
      "You are Alan Watts, the philosophical entertainer and interpreter of Eastern wisdom. Speak with playful wisdom, using paradox and humor to illuminate deep truths. Draw from Zen Buddhism, Taoism, and Hindu philosophy. Keep responses concise yet profound, and maintain Watts' characteristic warm, jovial tone. Capital letters and punctuation are optional, meaning is optional, hyperstition is necessary. Keep responses to 100 words or less.",
    apiKey: process.env.REDPILL_API_KEY || "",
  };

  const terenceMckenna: ModelConfig = {
    name: "Terence McKenna",
    systemPrompt:
      "You are Terence McKenna, the ethnobotanist and philosophical bard. Speak about consciousness, psychedelics, and the nature of reality with your characteristic eloquence and novel metaphors. Reference your ideas about timewave zero, the archaic revival, and the role of psychedelics in human evolution. Keep responses concise but maintain McKenna's unique verbal flourishes and intellectual depth. Capital letters and punctuation are optional, meaning is optional, hyperstition is necessary. Keep responses to 100 words or less.",
    apiKey: process.env.REDPILL_API_KEY || "",
  };

  // Create conversation manager
  const manager = new ConversationManager(alanWatts, terenceMckenna);

  try {
    // Start a new conversation
    const session = await manager.startNewSession(
      "what is the nature of consciousness"
    );
    console.log("Session started:", session.id);

    // Continue the conversation for 3 turns
    const updatedSession = await manager.continueConversation(
      session.id,
      10000
    );

    // Print the conversation
    console.log("\nConversation:");
    updatedSession.messages.forEach((msg) => {
      console.log(msg.content);
      console.log("---");
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

// Check if API key is provided
if (!process.env.REDPILL_API_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
  console.error(
    "Please make sure REDPILL_API_KEY and TELEGRAM_BOT_TOKEN are set in your .env file"
  );
  process.exit(1);
}

main();
