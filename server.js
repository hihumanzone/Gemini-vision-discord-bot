require('dotenv').config();
const { Client, Intents } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios').default;
const fetch = require('node-fetch');

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Helper to convert fetched images to Generative AI Part objects
async function urlToGenerativePart(url, mimeType) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}

// Analyze Command Handler
async function analyzeImage(imageUrl, inputText) {
  try {
    // Fetch and prepare the image for processing
    const imagePart = await urlToGenerativePart(imageUrl, 'image/png'); // Assumes the image is a PNG. Adjust mimeType if needed.

    // Generate content with the input text and image part
    const result = await model.generateContent([inputText, imagePart]);
    const response = await result.response;
    const text = await response.text();

    // Return the result text
    return text;
  } catch (error) {
    console.error('Error processing Gemini API request:', error);
    throw new Error('Failed to process image analysis. Please make sure the image URL is correct and accessible.');
  }
}

discordClient.once('ready', () => {
    console.log('Discord bot is ready!');
});

discordClient.on('messageCreate', async message => {
    if (!message.content.startsWith('/gemini_image') || message.author.bot) return;

    // Command syntax: /gemini_image url:[image URL] input:[text]
    const args = message.content.slice('/gemini_image'.length).trim().split(/ +/);
    const urlArg = args.find(arg => arg.startsWith('url:'));
    const inputArg = args.find(arg => arg.startsWith('input:'));

    if (!urlArg || !inputArg) {
      message.reply('Please use the correct format: `/gemini_image url:[image URL] input:[text]`');
      return;
    }

    const imageUrl = urlArg.slice('url:'.length);
    const inputText = inputArg.slice('input:'.length);

    try {
      const resultText = await analyzeImage(imageUrl, inputText);
      message.reply(resultText);
    } catch (error) {
      message.reply(error.message);
    }
});

discordClient.login(process.env.DISCORD_BOT_TOKEN);
