import mongoose, { Schema, Document } from "mongoose";
import { ChatSession } from "../types";

// Define the MongoDB schema for our sessions
interface IMessage {
  content: string;
}

interface ISession extends Document {
  id: string;
  timestamp: string;
  messages: IMessage[];
}

const SessionSchema = new Schema<ISession>({
  id: { type: String, required: true, unique: true },
  timestamp: { type: String, required: true },
  messages: [
    {
      content: { type: String, required: true },
    },
  ],
});

const Session = mongoose.model<ISession>("Session", SessionSchema);

export class DatabaseService {
  constructor() {
    // Connect to MongoDB
    mongoose
      .connect(process.env.MONGODB_URI!)
      .catch((error) => console.error("Database connection failed:", error));
  }

  async saveSession(session: ChatSession): Promise<void> {
    await Session.findOneAndUpdate({ id: session.id }, session, {
      upsert: true,
      new: true,
    });
  }

  async loadSession(sessionId: string): Promise<ChatSession | null> {
    return await Session.findOne({ id: sessionId });
  }
}
