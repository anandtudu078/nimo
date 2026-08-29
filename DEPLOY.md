# 🚀 Deploy to Railway

## Prerequisites
1. Railway account (https://railway.app)
2. MongoDB Atlas account (https://www.mongodb.com/atlas)
3. GitHub repository with your code

## Step 1: Set Up MongoDB Atlas

1. Go to https://www.mongodb.com/atlas and create a free account
2. Create a new cluster (free M0 tier)
3. Set up database access:
   - Go to "Database Access" → "Add New Database User"
   - Create a username and password
4. Set up network access:
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
5. Get your connection string:
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password

## Step 2: Push to GitHub

```bash
cd nimo
git add .
git commit -m "Add Docker and Railway deployment config"
git push origin main
```

## Step 3: Deploy to Railway

1. Go to https://railway.app and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `nimo` repository
4. Railway will detect the Dockerfile automatically

## Step 4: Configure Environment Variables

In Railway dashboard, go to your service → "Variables" and add:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/nimo?retryWrites=true&w=majority
JWT_SECRET=your-production-secret-key-here
CLIENT_URL=https://your-frontend-url.up.railway.app
PORT=5000
```

## Step 5: Deploy

1. Railway will automatically build and deploy
2. Check the deployment logs for any errors
3. Once deployed, you'll get a URL like: `https://your-project.up.railway.app`

## Step 6: Update Frontend

If you have a separate frontend deployment, update the API URL in your frontend:

```env
VITE_API_URL=https://your-backend.up.railway.app
```

## Troubleshooting

### Build fails
- Check that all dependencies are in `package.json`
- Ensure `npm run build` works locally

### MongoDB connection fails
- Verify your MongoDB Atlas connection string
- Ensure IP whitelist includes Railway's IPs (or 0.0.0.0/0)
- Check database user credentials

### App crashes on start
- Check deployment logs in Railway dashboard
- Ensure all environment variables are set

## Cost

- Railway free tier: $5 credit/month
- MongoDB Atlas free tier: M0 (512MB storage)
- Total cost for small projects: $0/month
