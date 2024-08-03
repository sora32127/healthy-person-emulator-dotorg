import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env' });

export default defineConfig({
  schema: './drizzle/schema.ts',
  dialect: 'sqlite',
  driver: 'turso'
});