import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const authClient = createAuthClient({
  baseURL: API_URL || window.location.origin,
  plugins: [magicLinkClient()],
});

export const { useSession, signIn, signOut } = authClient;
