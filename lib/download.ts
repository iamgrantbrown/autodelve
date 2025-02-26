import * as cheerio from 'cheerio';
import path from 'path';
import { URL } from 'url';
import { convertHTMLToMarkdown } from './convertHTML';
import { readdir  } from 'fs/promises';

function downloadWebsite(url: string, maxDepth: number = 3): Promise<Map<string, string>> {
  const visited = new Map<string, string>();
  
  async function crawl(currentUrl: string, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(currentUrl)) {
      return;
    }
    
    try {
      const response = await fetch(currentUrl);
      const html = await response.text();
      
      // Store the HTML content
      visited.set(currentUrl, html);
      
      // If we've reached max depth, don't extract more links
      if (depth === maxDepth) {
        return;
      }
      
      // Parse HTML and extract links
      const $ = cheerio.load(html);
      const links = new Set<string>();
      
      $('a').each((index: number, element) => {
        const href = $(element).attr('href');
        if (href) {
          // Resolve relative URLs
          const resolvedUrl = new URL(href, currentUrl).toString();
          
          // Only follow links from the same base URL
          const baseUrl = new URL(url).hostname;
          const resolvedUrlObj = new URL(resolvedUrl);
          
          if (resolvedUrlObj.hostname === baseUrl) {
            links.add(resolvedUrl);
          }
        }
      });
      
      // Recursively crawl all extracted links
      for (const link of links) {
        await crawl(link, depth + 1);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error crawling ${currentUrl}:`, error.message);
      } else {
        console.error(`Unknown error crawling ${currentUrl}`);
      }
    }
  }
  
  // Start crawling from the initial URL
  return crawl(url, 1).then(() => visited);
}


export async function download(url: string) {
  const websiteContent = await downloadWebsite(url);

  // Save each page to disk
  for (const [pageUrl, html] of websiteContent.entries()) {
    try {
      // Create a filename from the URL
      const filename = pageUrl
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_') + '.md';
      
      const filePath = path.join('content', filename);
      
      // Convert HTML to Markdown before saving
      const markdown = await convertHTMLToMarkdown(html);
      
      // Write the Markdown content to file
      await Bun.write(filePath, markdown);
      console.log(`Saved ${pageUrl} to ${filePath} (as Markdown)`);
    } catch (error) {
      console.error(`Failed to save ${pageUrl}:`, error);
    }
  }

  console.log(`Website content saved to 'content' directory`);
}

export async function readMarkdownFiles(): Promise<Array<{ name: string, content: string }>> {
  const contentDir = 'content';
const files = await readdir(contentDir);
  
  const markdownFiles = files.filter(file => file.endsWith('.md'));
  
  const result = await Promise.all(
    markdownFiles.map(async (filename) => {
      const filePath = path.join(contentDir, filename);
      const content = await Bun.file(filePath).text();
      return {
        name: filename,
        content
      };
    })
  );
  
  return result;
}