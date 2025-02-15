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
    this.totalPhases = 5;
    this.mainTheme = '';
    this.keyCharacters = new Set();
    this.plotPoints = [];
    this.storyContext = ''; // New field to maintain cumulative context
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
    this.groq = new Groq({ apiKey });
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
    this.maxPhases = 5;
  }

  generateGenre() {
    return this.genres[Math.floor(Math.random() * this.genres.length)];
  }

  initializeGame() {
    const genre = this.generateGenre();
    this.gameState = new GameState(genre);
  }


  createStoryPrompt() {
    if (this.gameState.currentPhase === 1) {
      return `
      You are a game master for a ${this.gameState.genre} story-based game.
      Create an engaging opening scene that introduces:
      1. A clear main conflict or goal
      2. The primary character(s)
      3. The setting
      
      This is phase 1 of ${this.maxPhases}. Plan the story arc accordingly.
      
      Format:
      [Story]: Write the story here
      [Choices]:
      1. First choice (relate to the main conflict)
      2. Second choice (provide an alternative approach)
      3. Third choice (allow for unexpected development)
      `;
    } else {
      // Build comprehensive story context
      const storyContext = this.gameState.fullStoryHistory
        .map((event, idx) => {
          return `Phase ${idx + 1}:
Story: ${event.story}
Player's Choice: ${event.choice}
Key Events: ${this.gameState.plotPoints[idx] || 'Continuing story development...'}
Active Characters: ${Array.from(this.getCharactersInPhase(event.story))}
`;
        })
        .join('\n\n');

      // Update cumulative context
      this.gameState.storyContext = storyContext;

      const isFinalPhase = this.gameState.currentPhase >= this.maxPhases;
      
      return `
      You are a game master for a ${this.gameState.genre} story-based game.
      
      Complete Story Overview:
      Main Theme: ${this.gameState.mainTheme}
      Current Phase: ${this.gameState.currentPhase} of ${this.maxPhases}
      Key Characters: ${Array.from(this.gameState.keyCharacters).join(', ')}
      
      Previous Story Development:
      ${this.gameState.storyContext}

      Last Player Choice: ${this.gameState.choicesHistory[this.gameState.choicesHistory.length - 1]}
      Major Plot Points: ${this.gameState.plotPoints.join('; ')}
      
      ${isFinalPhase ? `
      This is the FINAL PHASE. Create a meaningful conclusion that:
      1. Resolves the main conflict: ${this.gameState.mainTheme}
      2. Addresses these previous choices: ${this.gameState.choicesHistory.join(', ')}
      3. Provides closure for characters: ${Array.from(this.gameState.keyCharacters).join(', ')}
      ` : `
      Continue the story by:
      1. Building on these events: ${this.gameState.plotPoints.slice(-2).join('; ')}
      2. Developing character relationships: ${Array.from(this.gameState.keyCharacters).join(', ')}
      3. Advancing toward the resolution of: ${this.gameState.mainTheme}
      `}

      Format:
      [Story]: Write the story here
      [Choices]:
      ${isFinalPhase ? 
        `1. Choose a noble ending\n2. Choose a pragmatic ending\n3. Choose a dramatic ending` :
        `1. First choice (connected to current events)\n2. Second choice (alternative path)\n3. Third choice (unexpected development)`}
      `;
    }
  }

  getCharactersInPhase(story) {
    const characters = new Set();
    const possibleNames = story.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || [];
    possibleNames.forEach(name => {
      if (name.length > 1) { // Avoid single letters
        characters.add(name);
      }
    });
    return characters;
  }

  async generateResponse() {
    const prompt = this.createStoryPrompt();

    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a creative game master maintaining perfect story continuity.
            Track and reference:
            - All character actions and relationships
            - Every plot development and consequence
            - Story themes and atmosphere
            - Previous player choices and their impacts
            - Break the story into clear, distinct paragraphs
            - Each paragraph should be separated by a blank line
            - Each paragraph should focus on a single scene, event, or moment
            - Do not write the story as one continuous block of text
            - Keep paragraphs to 3-4 sentences for readability
            
            IMPORTANT FORMAT INSTRUCTIONS:
            1. Break your story into clear, distinct paragraphs
            2. Each paragraph should be separated by a blank line
            3. Each paragraph should focus on a single scene, event, or moment
            4. Do not write the story as one continuous block of text
            5. Keep paragraphs to 3-4 sentences for readability
            
            Your response must follow this exact format:
            [Story]: 
            (First paragraph)

            (Second paragraph)

            (Third paragraph)

            [Choices]: 
            1. (First choice)
            2. (Second choice)
            3. (Third choice)`,
        },
        { role: "user", content: prompt },
      ],
      model: "llama3-70b-8192",
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Rest of the method remains exactly the same
    const responseText = completion.choices[0].message.content;
    
    let storySection = "";
    let choices = [];
    
    try {
      if (responseText.includes("[Story]:") && responseText.includes("[Choices]:")) {
        storySection = responseText.split("[Choices]:")[0].replace("[Story]:", "").trim();
        const choicesSection = responseText.split("[Choices]:")[1];
        choices = choicesSection
          .split("\n")
          .map(choice => choice.replace(/^\d+\.\s*/, "").trim())
          .filter(choice => choice.length > 0);
      } else {
        const parts = responseText.split(/\d+\./);
        storySection = parts[0].trim();
        choices = parts
          .slice(1)
          .map(choice => choice.trim())
          .filter(choice => choice.length > 0);
      }

      if (this.gameState.currentPhase === 1) {
        this.gameState.mainTheme = this.extractMainTheme(storySection);
      }
      
      this.updateStoryElements(storySection);

      if (!storySection || choices.length === 0) {
        throw new Error("Invalid response format");
      }

      while (choices.length < 3) {
        choices.push("Continue with caution");
      }
      choices = choices.slice(0, 3);

      this.gameState.fullStoryHistory.push({
        phase: this.gameState.currentPhase,
        story: storySection,
        choices: choices
      });

      return { 
        story: storySection, 
        choices,
        isEnding: this.gameState.currentPhase >= this.maxPhases
      };
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return {
        story: "The story continues...",
        choices: [
          "Proceed carefully",
          "Investigate further",
          "Take a different approach"
        ],
        isEnding: this.gameState.currentPhase >= this.maxPhases
      };
    }
  }


  extractMainTheme(story) {
    const sentences = story.split('.');
    const mainTheme = sentences.slice(0, 2).join('.').trim();
    return mainTheme;
  }
  updateStoryElements(story) {
    // Extract and update characters
    const newCharacters = this.getCharactersInPhase(story);
    newCharacters.forEach(char => this.gameState.keyCharacters.add(char));

    // Extract plot points
    const sentences = story.split('.');
    const significantEvents = sentences
      .filter(sentence => 
        sentence.length > 30 && 
        (sentence.includes('but') || 
         sentence.includes('however') || 
         sentence.includes('suddenly') ||
         sentence.includes('decided') ||
         sentence.includes('realized'))
      )
      .map(sentence => sentence.trim());

    if (significantEvents.length > 0) {
      this.gameState.plotPoints.push(significantEvents[0]);
    } else {
      this.gameState.plotPoints.push(sentences[0].trim());
    }
  }

  updateSummary(story, choice) {
    // Add to story history
    if (!this.gameState.fullStoryHistory.find(h => h.story === story)) {
      this.gameState.fullStoryHistory.push({
        story,
        choice,
        phase: this.gameState.currentPhase
      });
    }

    // Update summary with phase information
    this.gameState.storySummary += `\nPhase ${this.gameState.currentPhase}: ${story.substring(0, 200)}... Player chose: ${choice}`;
    
    // Update choices history
    this.gameState.choicesHistory.push(choice);
    
    // Increment phase
    this.gameState.currentPhase += 1;

    // Update context
    this.gameState.storyContext = this.gameState.fullStoryHistory
      .map((event, idx) => `Phase ${idx + 1}:\nStory: ${event.story}\nChoice: ${event.choice}`)
      .join('\n\n');
  }

  async playTurn() {
    const response = await this.generateResponse();
    const images = await this.generateImagesForStory(response.story);
    const audioFile = await this.generateAudioForStory(
      response.story, 
      this.gameState.currentPhase
    );
    
    return { 
      story: response.story, 
      choices: response.choices, 
      isFinal: this.gameState.currentPhase >= this.gameState.totalPhases,
      images: images ? images.images : null,
      audioFile 
    };
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

  async generateAudioForStory(story, phase) {
    try {
      const response = await axios.post('http://localhost:5001/generate-audio', {
        text: story,
        phase: phase
      });
      return response.data.audioFile;
    } catch (error) {
      console.error('Error generating audio:', error);
      return null;
    }
  }

  async playTurn() {
    // Get the story and choices first
    const response = await this.generateResponse();
    
    // Generate images
    const images = await this.generateImagesForStory(response.story);
    
    // Generate audio
    const audioFile = await this.generateAudioForStory(
      response.story, 
      this.gameState.currentPhase
    );
    
    const isFinal = this.gameState.currentPhase >= this.gameState.totalPhases;
    
    return { 
      story: response.story, 
      choices: response.choices, 
      isFinal,
      images: images ? images.images : null,
      audioFile 
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
    // console.log(gameId);
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
    
    const { story, choices, isFinal, images, audioFile } = await gameMaster.playTurn();
    res.json({ story, choices, isFinal, images, audioFile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const NGROK_URL = "https://15e4-34-125-50-75.ngrok-free.app/post"; // Replace with your actual ngrok URL

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
    console.log(choice);
    if (!gameMaster) {
      return res.status(404).json({ error: "Game not found" });
    }

    // if (choice < 0 || choice > 2) {
    //   return res.status(400).json({ error: "Invalid choice" });
    // }

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

// Add this new endpoint to check for audio files
app.get('/api/check-audio/:phase', (req, res) => {
  const audioDir = path.join(__dirname, 'generated_audio');
  const phase = req.params.phase;
  const audioFile = `story_1.mp3`;
  const audioPath = path.join(audioDir, audioFile);

  try {
    if (fs.existsSync(audioPath)) {
      console.log(`Audio file found: ${audioFile}`);
      res.json({ 
        success: true,
        audioFile: audioFile,
        audioPath: `/audio/${audioFile}`
      });
    } else {
      console.log(`Audio file not found: ${audioFile}`);
      res.json({ 
        success: false,
        message: 'Audio file not yet generated'
      });
    }
  } catch (error) {
    console.error('Error checking for audio:', error);
    res.status(500).json({ 
      error: 'Failed to check audio', 
      details: error.message 
    });
  }
});

// Make sure this middleware is present to serve audio files
app.use('/audio', express.static(path.join(__dirname, 'generated_audio')));

// Add this new endpoint for manual choices
app.post('/api/game/:gameId/manual-choice', (req, res) => {
  try {
    const { choice } = req.body;
    const gameMaster = activeGames.get(req.params.gameId);
    
    if (!gameMaster) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (!choice || typeof choice !== 'string') {
      return res.status(400).json({ error: "Invalid choice" });
    }

    const { story } = gameMaster.gameState.fullStoryHistory[gameMaster.gameState.fullStoryHistory.length - 1] || {};
    gameMaster.updateSummary(story, choice);

    res.json({
      success: true,
      currentPhase: gameMaster.gameState.currentPhase,
      message: "Manual choice recorded successfully"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
