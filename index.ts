import { download, readMarkdownFiles } from './lib/download';
import { ask } from './lib/ask';
import { connect } from './lib/discord';
import * as fs from 'fs';
import * as path from 'path';

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];
const input = args[1];

// Check if content exists, if not and we're starting the bot, download it
const contentPath = path.join('content', 'website_content.json');
const contentExists = fs.existsSync(contentPath);

if (command === 'download' && input) {
  download(input);
} else if (command === 'ask' && input) {
  const answer = await ask(input);
  console.log(answer);
} else {
  console.log('Starting Discord bot...');
  
  // If content doesn't exist, download it first
  if (!contentExists) {
    console.log('Content file not found. Downloading Private AI documentation...');
    await download('https://docs.private-ai.com/');
    console.log('Download complete. Starting bot...');
  }
  
  connect();
}
