import { AppBskyActorDefs, ComAtprotoLabelDefs } from "@atproto/api";
import { DID, SIGNING_KEY, DELETE, PORT } from "./constants.js";
import { LabelerServer } from "@skyware/labeler";
import { createCanvas, loadImage } from "canvas";
import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { AtpAgent } from "@atproto/api";
import "dotenv/config";
import fs from "node:fs";


const agent = new AtpAgent({
  service: process.env.BSKY_SERVICE ?? "https://bsky.social",
});

await agent.login({
  identifier: process.env.BSKY_IDENTIFIER!,
  password: process.env.BSKY_PASSWORD!,
});

console.log("Logged in to BlueSky");

const server = new LabelerServer({ did: DID, signingKey: SIGNING_KEY });

server.start(PORT, (error, address) => {
  if (error) {
    console.error(error);
  } else {
    console.log(`Labeler server listening on ${address}`);
  }
});

const HOUSES = ["gryffindor", "slytherin", "ravenclaw", "hufflepuff"];

export const label = async (
  subject: string | AppBskyActorDefs.ProfileView,
  rkey: string
) => {
  const did = AppBskyActorDefs.isProfileView(subject) ? subject.did : subject;

  const query = server.db
    .prepare<unknown[], ComAtprotoLabelDefs.Label>(
      `SELECT * FROM labels WHERE uri = ?`
    )
    .all(did);

  const currentLabel = query.find(
    (label) => !label.neg && HOUSES.includes(label.val)
  );

  if (rkey.includes(DELETE)) {
    if (currentLabel) {
      await server
        .createLabels({ uri: did }, { negate: [currentLabel.val] })
        .catch((err) => console.log(err))
        .then(() => console.log(`Deleted label for ${did}`));
    }
  } else {
    if (currentLabel) {
      console.log(`${did} already has a house: ${currentLabel.val}`);
      return;
    }

    let avatarBuffer: Buffer;

    const avatar = `avatars/${subject}.png`;

    if (typeof subject === "string") {
      const { data } = await agent.getProfile({ actor: subject });
      if (!data) throw new Error("Profile not found");
      subject = data;
    }

    if (AppBskyActorDefs.isProfileView(subject) && subject.avatar) {
      const image = await loadImage(subject.avatar);
      const canvas = createCanvas(100, 100);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, 100, 100);
      avatarBuffer = canvas.toBuffer();
      fs.writeFileSync(avatar, avatarBuffer);
    } else {
      const canvas = createCanvas(1, 1);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 1, 1);
      avatarBuffer = canvas.toBuffer();
    }

    const promptTemplate = `
You're the Sorting Hat from Harry Potter, operating as a bot on the microblogging social network BlueSky on data from user profiles.
Which Hogwarts house would this user belong to?
${AppBskyActorDefs.isProfileView(subject) ? `
The user's name is ${subject.displayName || subject.handle} (@${subject.handle}).
${subject.description ? `Their bio is: "${subject.description}"` : ''}
` : ''}
If the user has an avatar, it's been attached to the message. If it's a 1x1 white image, please ignore it and focus on the name and bio.
`;

    await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptTemplate,
            },
            {
              type: "image",
              image: avatarBuffer,
            },
          ],
        },
      ],
      toolChoice: "required",
      tools: {
        decideHouse: tool({
          parameters: z.object({
            answer: z.union([z.literal("gryffindor"), z.literal("slytherin"), z.literal("ravenclaw"), z.literal("hufflepuff")]),
          }),
          execute: async ({ answer }) => {
            await server
              .createLabel({ uri: did, val: answer })
              .catch((err) => console.log(err))
              .then(() => console.log(`Labeled ${did} with ${answer}`));
            return answer;
          },
        }),
      },
    });
  }
};
