# MongoDB Atlas Setup for Render Deployment

## Problem
Your app on Render cannot connect to MongoDB Atlas because:
1. Render's IP address is not whitelisted in MongoDB Atlas
2. SSL/TLS configuration issues

## Solution

### Step 1: Whitelist All IPs (for Render)

Since Render uses dynamic IPs, you need to allow all IPs:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Click on your cluster
3. Click **"Network Access"** in the left sidebar
4. Click **"Add IP Address"** button
5. Click **"Allow Access from Anywhere"**
   - This adds `0.0.0.0/0` to the whitelist
6. Click **"Confirm"**

⚠️ **Note**: This is safe for production if you have strong authentication (username/password)

### Step 2: Verify Connection String

Your MongoDB connection string should look like this:

```
mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>?retryWrites=true&w=majority
```

Make sure:
- Username and password are correct (no special characters that need encoding)
- The database name is specified
- You're using `mongodb+srv://` (not `mongodb://`)

### Step 3: Update Render Environment Variables

1. Go to your Render Dashboard
2. Select your web service
3. Go to **"Environment"** tab
4. Add/Update these variables:
   - `MONGODB_URI` = Your full MongoDB Atlas connection string
   - `NODE_ENV` = `production`

### Step 4: Alternative - Use MongoDB on Render

If Atlas continues to have issues, consider using a MongoDB instance on Render:

1. In Render Dashboard, click **"New +"**
2. Select **"Private Service"**
3. Choose **MongoDB** from the template
4. Connect it to your web service

## Testing Locally

To test your connection string locally:

```bash
node test-mongodb-connection.js
```

## Common Issues

### Issue: "IP not whitelisted"
**Solution**: Add `0.0.0.0/0` in Network Access

### Issue: "Authentication failed"
**Solution**: 
- Check username/password
- URL-encode special characters in password
- Example: `p@ssw0rd` becomes `p%40ssw0rd`

### Issue: "SSL/TLS error"
**Solution**: Add these options to connection string:
```
?retryWrites=true&w=majority&ssl=true
```

## Need Help?

Run the diagnostic script:
```bash
node test-mongodb-connection.js
```
