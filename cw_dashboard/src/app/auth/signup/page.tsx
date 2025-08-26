'use client';

import { UserfrontSignUpForm } from '../../../components/auth/UserfrontSignUpForm';
import { AuthLayout } from '../../../components/auth/AuthLayout';

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start managing your invoices and payments"
      showBackToHome
    >
      <UserfrontSignUpForm />
    </AuthLayout>
  );
}