'use client';

import { UserfrontSignInForm } from '../../../components/auth/UserfrontSignInForm';
import { AuthLayout } from '../../../components/auth/AuthLayout';

export default function SignInPage() {
  return (
    <AuthLayout
      title="Sign In"
      subtitle="Welcome back to HSQ Bridge"
      showBackToHome
    >
      <UserfrontSignInForm />
    </AuthLayout>
  );
}