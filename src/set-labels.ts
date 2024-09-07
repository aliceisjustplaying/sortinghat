import { setLabelerLabelDefinitions, type LoginCredentials } from '@skyware/labeler/scripts';
import { type ComAtprotoLabelDefs } from '@atproto/api';
import 'dotenv/config';

const LABELS = [
  {
    identifier: 'ravenclaw',
    enName: 'Ravenclaw 🦅',
    enDescription: 'Wise, creative, and curious.', 
    ptName: 'Corvinal 🦅',
    ptDescription: 'Sábio, criativo e curioso.',
  },
  {
    identifier: 'slytherin',
    enName: 'Slytherin 🐍',
    enDescription: 'Ambitious, cunning, and resourceful.',
    ptName: 'Sonserina 🐍',
    ptDescription: 'Ambicioso, astuto e engenhoso.',
  },
  {
    identifier: 'gryffindor',
    enName: 'Gryffindor 🦁',
    enDescription: 'Brave, bold, and daring.',
    ptName: 'Grifinória 🦁',
    ptDescription: 'Corajoso, ousado e destemido.',
  },
  {
    identifier: 'hufflepuff',
    enName: 'Hufflepuff 🦡',
    enDescription: 'Loyal, hardworking, and fair.',
    ptName: 'Lufa-Lufa 🦡',
    ptDescription: 'Leal, trabalhador e justo.',
  },
]

const loginCredentials: LoginCredentials = {
  identifier: process.env.BSKY_IDENTIFIER!,
  password: process.env.BSKY_PASSWORD!,
};

const labelDefinitions: ComAtprotoLabelDefs.LabelValueDefinition[] = [];

for (const label of LABELS) {
    const labelValueDefinition: ComAtprotoLabelDefs.LabelValueDefinition = {
      identifier: label.identifier,
      severity: 'inform',
      blurs: 'none',
      defaultSetting: 'warn',
      adultOnly: false,
      locales: [
        {
          lang: 'en',
          name: label.enName,
          description: label.enDescription,
        },
        {
          lang: 'pt-BR',
          name: label.ptName,
          description: label.ptDescription,
        },
      ],
    };

    labelDefinitions.push(labelValueDefinition);
}

await setLabelerLabelDefinitions(loginCredentials, labelDefinitions);
