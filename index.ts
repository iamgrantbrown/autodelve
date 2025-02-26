import { download, readMarkdownFiles } from './lib/download';
import endent from 'endent';
import OpenAI from "openai";

const openai = new OpenAI();

// Construct a prompt that combines the question with the document content
function getPrompt(question: string, content: string) {
  const prompt = endent`
   
    DOCUMENTS:
    ${content}
    
    USER QUESTION:
    ${question}
    
    Please provide a clear, accurate answer based only on the information in the documents above. If the answer cannot be found in the documents, say so politely.
  `;

  return prompt;
}

async function ask(question: string) {
  const files = await readMarkdownFiles();
  const mappedFiles = files.map(file => file.content).join('\n');
  const prompt = getPrompt(question, mappedFiles);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-2024-11-20",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that answers questions based on the provided documents."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    stream: true,
  });

  for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0]?.delta.content || '' as string);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];
const input = args[1];

if (command === 'download' && input) {
  download(input);
} else if (command === 'ask' && input) {
  const answer = await ask(input);
  console.log(answer);
} else {
  console.log('Usage: bun run index.ts [download|ask] [url|question]');
}
