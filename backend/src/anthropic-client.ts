import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, "../.env") });

export function getAnthropicClient(provider: 'openrouter' | 'anthropic' = 'anthropic'): Anthropic {
  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set in environment variables');
    }

    return new Anthropic({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    return new Anthropic({
      apiKey: apiKey,
    });
  }
}

