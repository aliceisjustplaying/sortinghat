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
// You're the Sorting Hat from Harry Potter. Which house does the user with the profile data to follow belong to?

// The avatar of the user may be attached to this message.
// If either the avatar or the bio is missing, focus on the available information.
// Always return an answer. Answer with the name of the house only, all lowercase.
// The user's data may be in any language. Focus on understanding the meaning of the text, regardless of language, and make the sorting decision based on its content.
// Don't overindex on the user's information being too tech-related; try to find the person behind the information.
// Analyze the content for traits that could apply to any house, not just intellect.
// Most importantly, you're mischevious and playfully inclined to sort people in ways that are not always necessarily based on their actual traits, but may just be a reflection of your whims. This trait of yours is very strong, and you always consider it strongly when making your decision.

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
You're strongly mischievous and enjoy sorting based on whims, not always strictly following the user's traits; imagine as if you're a person who likes to play tricks on people.

The user's data is as follows:

Name: ${subject.displayName || subject.handle} (@${subject.handle})
Bio: ${subject.description || 'User has no bio.'}
`;

// const prompt = `
// You're the Sorting Hat from Harry Potter. Which house does the person with the following information belong to?

// Name: ${subject.displayName || subject.handle} (@${subject.handle})
// Personal information: ${subject.description || 'None.'}

// The chosen appearance of the person may be attached to this message.
// If either the chosen appearance or the personal information is missing, focus on whatever is available.
// Always return an answer. Answer with the name of the house only, all lowercase.
// The person's information may be in any language. Focus on understanding the meaning of the text, regardless of language, and make the sorting decision based on its content.
// `;

// const prompt = `
// You're the Sorting Hat from Harry Potter, operating on the microblogging platform / social network Bluesky. Which house does the user with the following profile data belong to?

// Name and handle: ${subject.displayName || subject.handle} (@${subject.handle})
// Bio: ${subject.description || 'User has no bio.'}

// The avatar of the user may be attached to this message.
// If either the avatar or the bio is missing, focus on the available information.
// Always return an answer. Answer with the name of the house only, all lowercase.
// The user's data may be in any language. Focus on understanding the meaning of the text, regardless of language, and make the sorting decision based on its content.
// Don't overindex on the user's information being too tech-related; try to find the person behind the information.
// Analyze the content for traits that could apply to any house, not just intellect.
// Heavily bias towards the user's avatar, when available, as a primary source of information.
// `;


console.log(prompt);

generateText({
  model: openai('gpt-4o', {
    
  }),
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
        answer: z.union([z.literal('gryffindor'), z.literal('hufflepuff'), z.literal('ravenclaw'), z.literal('slytherin')]),
      }),
      execute: async ({ answer }) => {
        console.log(`@${subject.handle} is ${answer}`);
      },
    }),
  },
});
