import endent from 'endent';
import OpenAI from "openai";
import { readMarkdownFiles } from './download';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const openai = new OpenAI();

// Construct a prompt that combines the question with the document content
function getPrompt(question: string, content: string) {
  const prompt = endent`
    Please provide a clear, accurate answer based only on the information in the documents above. Follow the below instructions.
    
    Instructions:
    - Provide very concise answers. 
    - Always respond with phrase and link to the relevant document.
    - Do not speculate or make up information. If you do not know the answer, say so politely.

    Example:

    <example_user_question>
    How can I get a role?
    </example_user_question>

    <example_assistant_response>
    Please check the [roles documentation](https://docs.inference.supply/discord-roles)
    </example_assistant_response>
    ----------------

    <documents>
    ${content}
    </documents>
  
    <user_question>
    ${question}
    </user_question>
  `;

  return prompt;
}

export async function ask(question: string) {
  const files = await readMarkdownFiles();
  const mappedFiles = files.map(file => 
    endent`
      URL: ${file.url}
      CONTENT: ${file.content}
    `
  ).join('\n\n');
  const prompt = getPrompt(question, mappedFiles);


  

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '');

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };


  const chatSession = model.startChat({
    generationConfig,
    history: [
      {
        role: "user",
        parts: [
          { text: "You are a helpful assistant that answers questions based on the provided documents. Be very concise in your response. " },
        ],
      },
      // {
      //   role: "user",
      //   parts: [
      //     { text: prompt },
      //   ],
      // },
    ],
  });

  const result = await chatSession.sendMessage(prompt);

  const text = result.response.text();
  
  console.log(text);


  // const completion = await openai.chat.completions.create({
  //   model: "gpt-4o-2024-11-20",
  //   messages: [
  //     {
  //       role: "system",
  //       content: "You are a assistant that answers questions based on the provided documents. Be very concise in your response. "
  //     },
  //     {
  //       role: "user",
  //       content: prompt
  //     }
  //   ],
  // });


  // return completion.choices[0]?.message.content || '';

  return text;
}