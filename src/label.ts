import { AppBskyActorDefs, ComAtprotoLabelDefs } from "@atproto/api";
import {
  DID,
  PORT,
  HOUSES,
  SIGNING_KEY,
  DELETE,
} from "./constants.js";
import { LabelerServer } from "@skyware/labeler";

const server = new LabelerServer({ did: DID, signingKey: SIGNING_KEY });

server.start(PORT, (error, address) => {
  if (error) {
    console.error(error);
  } else {
    console.log(`Labeler server listening on ${address}`);
  }
});

export const label = async (
  subject: string | AppBskyActorDefs.ProfileView,
  rkey: string,
) => {
  const did = AppBskyActorDefs.isProfileView(subject) ? subject.did : subject;

  const query = server.db
    .prepare<
      unknown[],
      ComAtprotoLabelDefs.Label
    >(`SELECT * FROM labels WHERE uri = ?`)
    .all(did);

  const labels = query.reduce((set, label) => {
    if (!label.neg) set.add(label.val);
    else set.delete(label.val);
    return set;
  }, new Set<string>());

  if (rkey.includes(DELETE)) {
    const randomHouse = HOUSES[Math.floor(Math.random() * HOUSES.length)];
    await server
      .createLabels({ uri: did }, { negate: [randomHouse] })
      .catch((err) => {
        console.log(err);
      })
      .then(() => console.log(`Deleted label ${randomHouse} for ${did}`));
  } else {
    const randomHouse = HOUSES[Math.floor(Math.random() * HOUSES.length)];
    await server
      .createLabel({ uri: did, val: randomHouse })
      .catch((err) => {
        console.log(err);
      })
      .then(() => console.log(`Labeled ${did} with ${randomHouse}`));
  }
};
