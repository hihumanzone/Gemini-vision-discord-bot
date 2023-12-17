const Discord = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch');
require('dotenv').config();

const discordClient = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES],
});

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const visionModel = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

async function imageAttachmentToGenerativePart(attachment) {
  const response = await fetch(attachment.url);
  const buffer = await response.buffer();
  return {
      inlineData: {
          data: buffer.toString("base64"),
          mimeType: attachment.contentType,
      },
  };
}

discordClient.on('messageCreate', async message => {
    if (message.author.bot || !message.content) return;

    const content = message.content.trim();
    const isMentioned = content.includes(`<@${discordClient.user.id}>`) || content.includes(`<@!${discordClient.user.id}>`);
    if (!isMentioned || message.attachments.size === 0) return;

    let totalSize = 0;
    message.attachments.forEach(attachment => {
      totalSize += attachment.size;
    });

    const totalSizeMB = totalSize / (1024 * 1024);

    if (totalSizeMB > 4) {
      await message.reply('The size of the image(s) is too large. Please make sure the total size is under 4MB.');
      return;
    }

    const attachmentsPromises = [...message.attachments.values()].map(imageAttachmentToGenerativePart);

    let generatingMessage = await message.reply('```Generating...```');

    Promise.all(attachmentsPromises).then(async imageParts => {
        try {
            const userInput = content.replace(/<@!?(\d+)>/, '').trim();
            const result = await visionModel.generateContentStream([userInput, ...imageParts]);

            let text = '';
            for await (const chunk of result.stream) {
                const chunkText = await chunk.text();
                text += chunkText;
                await generatingMessage.edit(`${text}`);
            }
        } catch (error) {
            console.error('Error generating response:', error);
            await generatingMessage.edit('Sorry, I was unable to analyze the image(s).');
        }
    }).catch(async error => {
        console.error('Error processing attachments:', error);
        await generatingMessage.edit('Sorry, there was an error processing the image attachments.');
    });
});

discordClient.once('ready', () => {
  console.log('Discord bot is ready!');
});

discordClient.login(process.env.DISCORD_BOT_TOKEN);
