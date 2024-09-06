import { createCanvas, loadImage } from 'canvas';
import fs from 'node:fs/promises';
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { AtpAgent } from '@atproto/api';
import 'dotenv/config';

const agent = new AtpAgent({
  service: process.env.BSKY_SERVICE ?? 'https://bsky.social',
});

await agent.login({
  identifier: process.env.BSKY_IDENTIFIER!,
  password: process.env.BSKY_PASSWORD!,
});

const did = agent.session!.did;

AtpAgent.configure({
  appLabelers: [did],
});

const userDid = process.argv[2];

if (!userDid) {
  console.error('Please provide a DID as an argument.');
  process.exit(1);
}

const avatar = `avatars/${userDid}.png`;

const { data } = await agent.getProfile({ actor: userDid });
if (!data) throw new Error('Profile not found');
const subject = data;

if (subject.labels && subject.labels.some((label) => label.src === did)) {
  throw new Error('Already ' + subject.labels.find((label) => label.src === did)?.val);
}

if (!subject.avatar) throw new Error('No avatar');

const image = await loadImage(subject.avatar);
const canvas = createCanvas(100, 100);
const ctx = canvas.getContext('2d');
ctx.drawImage(image, 0, 0, 100, 100);
await fs.writeFile(avatar, canvas.toBuffer());

const prompt = `
Is ${subject.displayName || subject.handle} (@${subject.handle}) kiki or bouba?
Bouba = round, soft, and curvy. Kiki = sharp, jagged, and angular.
Their bio is: ${subject.description || 'No bio provided'}.
If they have no bio, focus on their avatar and display name.
`;

generateText({
  model: openai('gpt-4o'),
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
        },
      ],
    },
  ],
  toolChoice: 'required',
  tools: {
    decide: tool({
      parameters: z.object({
        answer: z.union([z.literal('kiki'), z.literal('bouba')]),
      }),
      execute: async ({ answer }) => {
        console.log(`@${subject.handle} is ${answer}`);
      },
    }),
  },
});
