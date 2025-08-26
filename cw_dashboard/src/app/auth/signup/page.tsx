/**
 * Sign Up Page
 * User registration page with optional tenant creation
 */

import { AuthLayout } from '../../../components/auth/AuthLayout';
import { SignUpForm } from '../../../components/auth/SignUpForm';

export const metadata = {
  title: 'Sign Up - HS Bridge Dashboard',
  description: 'Create a new account to get started with HubSpot-Stripe-QuickBooks Bridge'
};

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started with HS Bridge today."
    >
      <SignUpForm />
    </AuthLayout>
  );
}