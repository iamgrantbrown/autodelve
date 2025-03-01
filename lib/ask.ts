import endent from 'endent';
import OpenAI from "openai";
import { readMarkdownFiles } from './download';
import { zodFunction } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI();

/**
 * Sanitizes user input to prevent potential security issues
 * @param input The user input to sanitize
 * @returns Sanitized input string
 */
function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove any control characters
  let sanitized = input.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Limit length to prevent excessive token usage
  sanitized = sanitized.slice(0, 500);
  
  return sanitized;
}

async function shouldAnswer(question: string, content: string) {
  const prompt = getPrompt(question, content);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert technical support agent with deep knowledge of Private AI documentation. Your goal is to provide accurate, helpful answers to technical questions. Analyze the content carefully to determine if you have sufficient information to provide technical support."
      },
      {
        role: "user",
        content: prompt
      },
    ],
    tool_choice: {
      "type": "function",
      "function": {
        "name": "submitIsAnswerable"
      }
    },
    tools: [
      zodFunction({ name: "submitIsAnswerable", parameters: SubmitIsAnswerableSchema }),
    ],
  });

  console.log(JSON.stringify(completion.choices[0] ?? '', null, 2));

  const { isAnswerable } = JSON.parse(completion.choices[0]?.message.tool_calls?.[0]?.function.arguments ?? '{}') as SubmitIsAnswerable;

  return isAnswerable;
}

// Construct a prompt that combines the question with the document content
function getPrompt(question: string, content: string) {
  const prompt = endent`
    <documents>
    ${content}
    </documents>

    Please provide expert technical support based on the information in the documents above. Follow these instructions carefully:
    
    Instructions:
    - Provide technically precise answers that directly address the user's problem
    - Include step-by-step instructions when explaining processes or solutions
    - Use code examples, configuration snippets, or command-line instructions when relevant
    - Explain technical concepts clearly while using appropriate terminology
    - Reference specific documentation sections with links for further reading
    - Offer troubleshooting steps for common issues related to the question
    - If you don't have enough information to solve the problem completely, provide what you can and suggest what additional information might be needed
    - Maintain a professional, helpful tone appropriate for technical support

    Example:

    <example_user_question>
    How do I implement PII detection in my application?
    </example_user_question>

    <example_assistant_response>
    ## Implementing PII Detection

    To implement PII detection in your application using Private AI, follow these steps:

    1. **Install the SDK**:
       \`\`\`bash
       pip install privateai
       \`\`\`

    2. **Configure your API key**:
       \`\`\`python
       import privateai
       privateai.api_key = "your_api_key_here"
       \`\`\`

    3. **Call the detection endpoint**:
       \`\`\`python
       from privateai import Client
       
       client = Client()
       result = client.detect_pii(text="My email is john.doe@example.com")
       print(result.entities)  # List of detected PII entities
       \`\`\`

    For more advanced configuration options, refer to the [PII Detection API documentation](https://docs.privateai.com/detection).

    **Troubleshooting**:
    - If you receive authentication errors, verify your API key is correct
    - For performance issues, consider batching requests as shown in the [performance optimization guide](https://docs.privateai.com/optimization)

    You might also want to explore [PII redaction](https://docs.privateai.com/redaction) for automatically removing sensitive information from your data.
    </example_assistant_response>
    ----------------

    <user_question>
    ${question}
    </user_question>
  `;

  return prompt;
}

const SubmitIsAnswerableSchema = z.object({
  isAnswerable: z.boolean().describe("Whether the question can be answered based on the documents"),
});

type SubmitIsAnswerable = z.infer<typeof SubmitIsAnswerableSchema>;

export async function ask(question: string): Promise<string | null> {
  // Sanitize the input question
  const sanitizedQuestion = sanitizeInput(question);
  
  // If the question is empty after sanitization, don't process it
  if (!sanitizedQuestion) {
    console.log('Empty question after sanitization');
    return null;
  }
  
  const files = await readMarkdownFiles();
  
  // Improve content mapping to provide better context
  const mappedFiles = files.map(file =>
    endent`
      URL: ${file.url}
      TITLE: ${file.url.split('/').pop() || 'Main Page'}
      CONTENT: ${file.content}
    `
  ).join('\n\n');


  const prompt = getPrompt(sanitizedQuestion, mappedFiles);

  const shouldRespond = await shouldAnswer(sanitizedQuestion, mappedFiles);

  if (!shouldRespond) {
    console.log('Not answering question:', sanitizedQuestion);
    return null;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert technical support agent specializing in Private AI documentation. Provide thorough, technically precise answers that solve the user's problem. Use appropriate technical terminology while remaining clear and accessible. Include code examples, configuration snippets, and troubleshooting steps when relevant. IMPORTANT: Keep your responses under 1800 characters when possible to avoid Discord message length limitations."
      },
      {
        role: "user",
        content: prompt
      },
    ],
    temperature: 0.7,
    max_tokens: 800  // Reduced from 1000 to help keep responses shorter
  });


  const answer = completion.choices[0]?.message.content || '';

  return answer;
}

