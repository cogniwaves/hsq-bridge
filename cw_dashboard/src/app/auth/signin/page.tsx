'use client';

import { SignInForm } from '../../../components/auth/SignInForm';
import { AuthLayout } from '../../../components/auth/AuthLayout';

export default function SignInPage() {
  return (
    <AuthLayout
      title="Sign In"
      subtitle="Welcome back to HSQ Bridge"
      showBackToHome
    >
      <SignInForm />
    </AuthLayout>
  );
}