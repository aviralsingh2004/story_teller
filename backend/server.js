import Groq from "groq-sdk"; // Import Groq SDK
import dotenv from "dotenv"; // To manage API keys securely
import express from "express";
import cors from "cors";
import axios from "axios";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class GameState {
  constructor(genre) {
    this.genre = genre;
    this.currentPhase = 1;
    this.storySummary = "";
    this.choicesHistory = [];
    this.fullStoryHistory = [];
    this.totalPhases = 5; // Reduce for testing
  }
}

class SceneStructure {
  constructor(scene1, scene2) {
    this.scene1 = scene1;
    this.scene2 = scene2;
  }
}

class GameMaster {
  constructor(apiKey) {
    this.groq = new Groq({ apiKey }); // Initialize Groq SDK client
    this.gameState = null;
    this.genres = [
      "fantasy",
      "sci-fi",
      "mystery",
      "horror",
      "adventure",
      "cyberpunk",
      "post-apocalyptic",
    ];
  }

  generateGenre() {
    return this.genres[Math.floor(Math.random() * this.genres.length)];
  }

  initializeGame() {
    const genre = this.generateGenre();
    this.gameState = new GameState(genre);
  }

  createStoryPrompt() {
    if (!this.gameState.storySummary) {
      return `
      You are a game master for a ${this.gameState.genre} story-based game.
      Create an engaging opening scene and provide three distinct choices for the player.
      Format:
      [Story]: Write the story here
      [Choices]:
      1. First choice
      2. Second choice
      3. Third choice
      `;
    } else {
      const storyContext = this.gameState.fullStoryHistory
        .map(
          (event, idx) =>
            `Phase ${idx + 1}:\nStory: ${event.story}\nPlayer chose: ${event.choice}`
        )
        .join("\n");

      return `
      You are a game master for a ${this.gameState.genre} story-based game.

      Complete story so far:
      ${storyContext}

      Last player choice: ${this.gameState.choicesHistory.slice(-1)[0]}
      Current phase: ${this.gameState.currentPhase}

      Continue the story based on all previous events and the player's choices.
      Ensure strong continuity with previous events and maintain consistent character development.

      Format:
      [Story]: Write the story here
      [Choices]:
      1. First choice
      2. Second choice
      3. Third choice
      `;
    }
  }

  async generateResponse() {
    const prompt = this.createStoryPrompt();

    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a creative game master focused on maintaining story continuity and coherent narrative development. Always format your response with [Story]: followed by the story and [Choices]: followed by numbered choices.",
        },
        { role: "user", content: prompt },
      ],
      model: "llama3-70b-8192",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0].message.content;
    
    let storySection = "";
    let choices = [];
    
    try {
      // Try to parse with markers first
      if (responseText.includes("[Story]:") && responseText.includes("[Choices]:")) {
        storySection = responseText.split("[Choices]:")[0].replace("[Story]:", "").trim();
        const choicesSection = responseText.split("[Choices]:")[1];
        if (choicesSection) {
          choices = choicesSection
            .split("\n")
            .map(choice => choice.replace(/^\d+\.\s*/, "").trim())
            .filter(choice => choice.length > 0);
        }
      } else {
        // Fallback: Try to split on numbered choices
        const parts = responseText.split(/\d+\./);
        storySection = parts[0].trim();
        choices = parts
          .slice(1)
          .map(choice => choice.trim())
          .filter(choice => choice.length > 0);
      }

      // Ensure we have valid story and choices
      if (!storySection || choices.length === 0) {
        throw new Error("Invalid response format");
      }

      // Ensure we have exactly 3 choices
      while (choices.length < 3) {
        choices.push("Continue with caution");
      }
      choices = choices.slice(0, 3);

      return { 
        story: storySection, 
        choices
      };
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return {
        story: "The story continues...",
        choices: [
          "Proceed carefully",
          "Investigate further",
          "Take a different approach"
        ]
      };
    }
  }

  updateSummary(story, choice) {
    this.gameState.fullStoryHistory.push({
      story,
      choice,
      phase: this.gameState.currentPhase,
    });

    this.gameState.storySummary += `\nPhase ${this.gameState.currentPhase}: ${story.substring(
      0,
      200
    )}... Player chose: ${choice}`;
    this.gameState.choicesHistory.push(choice);
    this.gameState.currentPhase += 1;
  }

  async generateImagesForStory(story) {
    try {
      if (!story) {
        console.log("No story provided for image generation");
        return null;
      }

      const scene1 = `${this.gameState.genre} style: ${story.substring(0, 100)}`;
      const scene2 = `${this.gameState.genre} style: ${story.substring(Math.max(0, story.length - 100))}`;

      console.log("Generating images for scenes:", { scene1, scene2 });

      const response = await axios.post(`http://localhost:4000/generate-images`, {
        scene1,
        scene2
      });

      console.log("Image generation response received");
      return response.data;
    } catch (error) {
      console.error("Error generating images:", error.message);
      return null;
    }
  }

  async playTurn() {
    // Get the story and choices first
    const response = await this.generateResponse();
    
    // Generate images only once here
    const images = await this.generateImagesForStory(response.story);
    
    const isFinal = this.gameState.currentPhase >= this.gameState.totalPhases;
    
    return { 
      story: response.story, 
      choices: response.choices, 
      isFinal,
      images: images ? images.images : null 
    };
  }
}

// Store active games in memory (consider using a proper database for production)
const activeGames = new Map();

// Initialize a new game
app.post('/api/game/start', (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("No API key found");
    }

    const gameMaster = new GameMaster(apiKey);
    gameMaster.initializeGame();
    
    // Generate a unique game ID
    const gameId = Date.now().toString();
    activeGames.set(gameId, gameMaster);

    res.json({
      gameId,
      genre: gameMaster.gameState.genre,
      message: "Game initialized successfully"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get the next turn
app.get('/api/game/:gameId/turn', async (req, res) => {
  try {
    const gameMaster = activeGames.get(req.params.gameId);
    if (!gameMaster) {
      return res.status(404).json({ error: "Game not found" });
    }
    console.log("checking");
    
    const { story, choices, isFinal, images } = await gameMaster.playTurn();
    res.json({ story, choices, isFinal, images });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const NGROK_URL = "https://ccd3-34-16-223-70.ngrok-free.app/post"; // Replace with your actual ngrok URL

app.post("/generate-images", async (req, res) => {
  try {
    const { scene1, scene2 } = req.body;

    if (!scene1 || !scene2) {
      return res.status(400).json({ error: "Scene descriptions are required" });
    }

    const payload = {
      prompts: [scene1, scene2],
    };

    const response = await axios.post(NGROK_URL, payload, {
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"];
    if (contentType.includes("application/json")) {
      return res.status(400).json({ error: "Unexpected JSON response", details: response.data });
    }

    const zipBuffer = Buffer.from(response.data);
    const zip = new AdmZip(zipBuffer);
    
    const outputDir = path.join(__dirname, "extracted_images");
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    zip.extractAllTo(outputDir, true);
    console.log(`Images extracted to: ${outputDir}`);

    const files = fs.readdirSync(outputDir);
    const imagePaths = files.map(file => path.join(outputDir, file));

    res.json({ 
      message: "Images generated successfully!", 
      outputDir,
      images: imagePaths
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Failed to process request", details: error.message });
  }
});
// Submit a choice
app.post('/api/game/:gameId/choice', (req, res) => {
  try {
    const { choice } = req.body;
    const gameMaster = activeGames.get(req.params.gameId);
    
    if (!gameMaster) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (choice < 0 || choice > 2) {
      return res.status(400).json({ error: "Invalid choice" });
    }

    const { story, choices } = gameMaster.gameState.fullStoryHistory[gameMaster.gameState.fullStoryHistory.length - 1] || {};
    gameMaster.updateSummary(story, choices[choice]);

    res.json({
      success: true,
      currentPhase: gameMaster.gameState.currentPhase,
      message: "Choice recorded successfully"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get game state
app.get('/api/game/:gameId/state', (req, res) => {
  try {
    const gameMaster = activeGames.get(req.params.gameId);
    if (!gameMaster) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.json({
      genre: gameMaster.gameState.genre,
      currentPhase: gameMaster.gameState.currentPhase,
      totalPhases: gameMaster.gameState.totalPhases,
      storyHistory: gameMaster.gameState.fullStoryHistory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this new endpoint to check for images
app.get('/api/check-images', (req, res) => {
  const imagesDir = path.join(__dirname, 'extracted_images');
  
  try {
    if (!fs.existsSync(imagesDir)) {
      return res.json({ images: [] });
    }

    const files = fs.readdirSync(imagesDir)
      .filter(file => file.startsWith('image_') && file.endsWith('.png'))
      .sort((a, b) => {
        // Extract numbers from filenames and sort numerically
        const numA = parseInt(a.match(/image_(\d+)/)[1]);
        const numB = parseInt(b.match(/image_(\d+)/)[1]);
        return numA - numB;
      });

    // Get the two most recent images
    const recentImages = files.slice(-2);
    
    if (recentImages.length > 0) {
      console.log('Found images:', recentImages);
    } else {
      console.log('No images found in directory');
    }

    res.json({ 
      images: recentImages,
      imagesPath: imagesDir
    });

  } catch (error) {
    console.error('Error checking for images:', error);
    res.status(500).json({ 
      error: 'Failed to check images', 
      details: error.message 
    });
  }
});

// Update the existing static files middleware to use the correct path
app.use('/extracted_images', express.static(path.join(__dirname, 'extracted_images')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
