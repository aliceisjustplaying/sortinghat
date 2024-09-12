import 'dotenv/config';

export const DID = process.env.DID ?? '';
export const SIGNING_KEY = process.env.SIGNING_KEY ?? '';
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4001;
export const DELETE = '3l3izhv734g2o';
export const RELAY = process.env.RELAY ?? 'ws://localhost:6008/subscribe';
export const HOUSES = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];
