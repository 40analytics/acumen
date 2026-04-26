import SignIn from './SignIn';

// Sign-up reuses the sign-in flow (magic link + Google). Better Auth
// auto-creates the user on first auth, so the journey is identical.
// We swap the heading via context elsewhere if needed.
export default function SignUp() {
  return <SignIn />;
}
