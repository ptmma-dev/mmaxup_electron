const { execSync } = require('child_process')
const path = require('path')
const dotenv = require('dotenv')

// Load environment variables from .env file
const result = dotenv.config({ path: path.resolve(__dirname, '../.env') })

if (result.error) {
  console.warn('Warning: .env file not found or could not be loaded.')
}

// Get GH_TOKEN from environment
const ghToken = process.env.GH_TOKEN

if (!ghToken) {
  console.error('Error: GH_TOKEN not found in environment variables or .env file.')
  console.error('Please add GH_TOKEN=your_token to your .env file to publish to GitHub.')
  process.exit(1)
}

console.log('Starting build and release process...')
console.log('GitHub Token found via .env')

// Determine command based on argument (linux/win/mac/all)
const target = process.argv[2] || 'linux'
let buildCommand = ''

switch (target) {
  case 'linux':
    buildCommand = 'npm run build && electron-builder --linux --publish always'
    break
  case 'win':
    buildCommand = 'npm run build && electron-builder --win --publish always'
    break
  case 'mac':
    buildCommand = 'npm run build && electron-builder --mac --publish always'
    break
  case 'all':
    buildCommand = 'npm run build && electron-builder --win --linux --publish always'
    break
  default:
    console.error('Unknown target:', target)
    process.exit(1)
}

try {
  // Execute the build command with inherited stdio to see output
  // The GH_TOKEN is already in process.env so electron-builder will pick it up
  execSync(buildCommand, { stdio: 'inherit', env: process.env })
  console.log('Release process completed successfully!')
} catch (error) {
  console.error('Release process failed.')
  process.exit(1)
}
