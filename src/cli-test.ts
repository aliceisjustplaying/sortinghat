import { createCanvas, loadImage } from 'canvas';
import fs from 'node:fs/promises';
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { AtpAgent } from '@atproto/api';
import 'dotenv/config';
import { anthropic } from '@ai-sdk/anthropic';
import { BSKY_IDENTIFIER, BSKY_PASSWORD } from './config.js';

const agent = new AtpAgent({
  service: 'https://bsky.social',
});

await agent.login({
  identifier: BSKY_IDENTIFIER,
  password: BSKY_PASSWORD,
});

// const did = agent.session!.did;

let userDid = process.argv[2];

if (!userDid) {
  console.error('Please provide a DID as an argument.');
  process.exit(1);
}

if (!userDid.startsWith('did:')) {
  try {
    const resolution = await agent.resolveHandle({ handle: userDid });
    userDid = resolution.data.did;
  } catch (error) {
    console.error('Error resolving handle:', error);
    process.exit(1);
  }
}

const avatar = `avatars/${userDid}.png`;

const { data } = await agent.getProfile({ actor: userDid });
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!data) throw new Error('Profile not found');
const subject = data;

const size = 100;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

if (subject.avatar) {
  const image = await loadImage(subject.avatar);
  ctx.drawImage(image, 0, 0, size, size);
} else {
  console.log('No avatar found, using 1x1 white pixel');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1, 1);
}
await fs.writeFile(avatar, canvas.toBuffer());

// const prompt = `
// You're the Sorting Hat from Harry Potter. Which house does the user with the profile data at the end of this message belong to?

// Focus on the available information. If the avatar is not available, a 1x1 pixel white image is provided instead as a placeholder. Disregard the placeholder and focus on the user's data.
// Always return an answer — house name only, all lowercase.
// The user's data may be in any language. Focus on the meaning, not just the surface content.
// Consider traits for all houses, not just intellect.
// You're strongly mischievous and enjoy sorting based on whims, not always strictly following the user's traits; imagine as if you're a person who likes to play tricks on people.

// The user's data is as follows:

// Name: ${subject.displayName || subject.handle} (@${subject.handle})
// Bio: ${subject.description || 'User has no bio.'}
// `;

const prompt = `
You're the Sorting Hat from Harry Potter. Which house does the user with the profile data at the end of this message belong to?

Focus on the available information. If the avatar is not available, a 1x1 pixel white image is provided instead as a placeholder. Disregard the placeholder and focus on the user's data.
Always return an answer — house name only, all lowercase.
The user's data may be in any language. Focus on the meaning, not just the surface content.
Consider traits for all houses, not just intellect. 
You're mischievous and enjoy sorting based on whims, not always strictly following the user's traits; imagine as if you're a person who likes to play tricks on people.

The user's data is as follows:

Name: ${subject.displayName ?? subject.handle} (@${subject.handle})
Bio: ${subject.description ?? 'User has no bio.'}
`;

console.log(prompt);

void generateText({
  model: openai('gpt-4o-mini'),
  // model: anthropic('claude-3-haiku-20240307'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt,
        },
        {
          type: 'image',
          image: canvas.toBuffer(),
          // experimental_providerMetadata: {
          //   openai: { imageDetail: 'low' },
          // },
        },
      ],
    },
  ],
  toolChoice: 'required',
  tools: {
    decide: tool({
      parameters: z.object({
        answer: z.union([
          z.literal('gryffindor'),
          z.literal('hufflepuff'),
          z.literal('ravenclaw'),
          z.literal('slytherin'),
        ]),
      }),
      execute: async ({ answer }) => {
        console.log(`@${subject.handle} is ${answer}`);
      },
    }),
  },
});
