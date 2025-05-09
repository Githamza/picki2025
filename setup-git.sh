#!/bin/bash

# Add all files to Git
git add .

# Create initial commit
git commit -m "Initial commit - Angular Kiosk Order App"

# Instructions for creating a private repo
echo ""
echo "==== SETUP COMPLETE ===="
echo ""
echo "To create a private repository on GitHub:"
echo "1. Go to https://github.com/new"
echo "2. Name your repository"
echo "3. Set visibility to 'Private'"
echo "4. Do NOT initialize with README, .gitignore, or license"
echo "5. Click 'Create repository'"
echo ""
echo "Then link your local repository with these commands:"
echo "git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git"
echo "git branch -M main"
echo "git push -u origin main"
echo ""
echo "For GitLab, visit: https://gitlab.com/projects/new"
echo "For Bitbucket, visit: https://bitbucket.org/repo/create"
echo "" 