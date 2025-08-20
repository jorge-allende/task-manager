#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating Convex configuration...\n');

const convexDir = path.join(process.cwd(), 'convex');
let hasErrors = false;

// Check if convex directory exists
if (!fs.existsSync(convexDir)) {
  console.error('❌ Convex directory not found');
  process.exit(1);
}

// Check for required files
const requiredFiles = ['schema.ts', '_generated/api.d.ts'];
const missingFiles = [];

requiredFiles.forEach(file => {
  const filePath = path.join(convexDir, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.error('❌ Missing required Convex files:');
  missingFiles.forEach(file => console.error(`   - ${file}`));
  hasErrors = true;
} else {
  console.log('✅ All required Convex files present');
}

// Get all TypeScript files in convex directory
const convexFiles = fs.readdirSync(convexDir)
  .filter(file => file.endsWith('.ts') && !file.startsWith('_generated'));

console.log(`\n📁 Found ${convexFiles.length} Convex files to validate:\n`);

// Type check each file
convexFiles.forEach(file => {
  const filePath = path.join(convexDir, file);
  try {
    execSync(`npx tsc "${filePath}" --noEmit --skipLibCheck --esModuleInterop --resolveJsonModule`, {
      stdio: 'pipe'
    });
    console.log(`   ✅ ${file}`);
  } catch (error) {
    console.error(`   ❌ ${file}`);
    if (error.stdout) {
      console.error(error.stdout.toString());
    }
    if (error.stderr) {
      console.error(error.stderr.toString());
    }
    hasErrors = true;
  }
});

// Check for common issues
console.log('\n🔍 Checking for common issues...\n');

// Check if auth.config.ts exists (required for Clerk integration)
const authConfigPath = path.join(convexDir, 'auth.config.ts');
if (!fs.existsSync(authConfigPath)) {
  console.warn('⚠️  Warning: auth.config.ts not found - Clerk authentication may not work');
} else {
  console.log('✅ auth.config.ts found');
}

// Check for http.ts (webhooks)
const httpPath = path.join(convexDir, 'http.ts');
if (!fs.existsSync(httpPath)) {
  console.warn('⚠️  Warning: http.ts not found - Webhooks may not be configured');
} else {
  console.log('✅ http.ts found (webhooks configured)');
}

// Final result
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('\n❌ Convex validation failed with errors\n');
  process.exit(1);
} else {
  console.log('\n✅ Convex validation successful!\n');
  process.exit(0);
}