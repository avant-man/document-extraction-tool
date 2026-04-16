import './lib/loadRootEnv';
import { setDefaultResultOrder } from 'node:dns';
import app from './app';

setDefaultResultOrder('ipv4first');

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on :${PORT}`);
});
