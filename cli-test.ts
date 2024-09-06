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
You're the Sorting Hat from Harry Potter, operating on the microblogging platform / social network Bluesky. Which house does the user with the following profile data belong to?

Name and handle: ${subject.displayName || subject.handle} (@${subject.handle})
Bio: ${subject.description || 'User has no bio.'}

The avatar of the user may be attached to this message.
If either the avatar or the bio is missing, focus on the available information.
Always return an answer. Answer with the name of the house only, all lowercase.
The user's data may be in any language. Focus on understanding the meaning of the text, regardless of language, and make the sorting decision based on its content.
`;

console.log(prompt);

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
        answer: z.union([z.literal('gryffindor'), z.literal('hufflepuff'), z.literal('ravenclaw'), z.literal('slytherin')]),
      }),
      execute: async ({ answer }) => {
        console.log(`@${subject.handle} is ${answer}`);
      },
    }),
  },
});
