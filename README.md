# autodelve
A simple AI-powered Discord to answer questions based on a set of documents.

> **Note:** This repo is a work in progress.
>
> ## TODOs
1. Integrate with Discord.js
2. Better documentation

## Setup

```bash
bun install
```

### Create a `.env` file

```bash
cp .env.example .env
```

Edit the `.env` file with your own values.


### Index a website

```bash
bun run index.ts download https://docs.inference.net
```

This command will download the website, convert the HTML to Markdown, and save the content to the `content` directory.

Once a website has been indexed, you can ask questions to the AI by running:

```bash
bun run index.ts ask "How can I get started with inference.net?"
```

The response will be streamed to the console.




