const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const serverEnv = {
  STRIPE_SECRET_KEY: requiredEnv('STRIPE_SECRET_KEY'),
  STRIPE_IDENTITY_RETURN_URL: requiredEnv('STRIPE_IDENTITY_RETURN_URL'),
  STRIPE_WEBHOOK_SECRET_IDENTITY: requiredEnv('STRIPE_WEBHOOK_SECRET_IDENTITY'),
  STRIPE_IDENTITY_FLOW_ID: requiredEnv('STRIPE_IDENTITY_FLOW_ID'),
  SUPABASE_SERVICE_ROLE_KEY: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
};
