/**
 * Sign In Page
 * User authentication page with email and password
 */

import { AuthLayout } from '../../../components/auth/AuthLayout';
import { SignInForm } from '../../../components/auth/SignInForm';

export const metadata = {
  title: 'Sign In - HS Bridge Dashboard',
  description: 'Sign in to your account to access the HubSpot-Stripe-QuickBooks Bridge dashboard'
};

export default function SignInPage() {
  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Welcome back! Please enter your details."
    >
      <SignInForm />
    </AuthLayout>
  );
}