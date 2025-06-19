# Deployment Guide

## 1. Vercel Setup

1. Go to [Vercel](https://vercel.com) and sign in with your GitHub account
2. Click "New Project" and import the `domaintobiz` repository
3. Configure the build settings:
   - Framework Preset: Other
   - Build Command: (leave empty)
   - Output Directory: public
   - Install Command: npm install

## 2. Environment Variables

Add these environment variables in Vercel dashboard:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
OPENAI_API_KEY=sk-proj-your-openai-key
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-key
NODE_ENV=production
```

## 3. Supabase Setup

1. Go to [Supabase](https://supabase.com) and create a new project
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Copy your project URL and anon key to Vercel environment variables

## 4. Deploy

1. Push any changes to the main branch
2. Vercel will automatically deploy
3. Your app will be live at `https://your-project-name.vercel.app`

## 5. Custom Domain (Optional)

1. In Vercel dashboard, go to your project settings
2. Add your custom domain
3. Follow DNS configuration instructions

## API Endpoints

- `/api/analyze` - Domain analysis
- `/api/strategy` - Business strategy generation  
- `/api/execute` - Website generation
- `/api/deployed` - List deployed websites

## Testing

Visit your deployed URL and test the domain analysis flow end-to-end.