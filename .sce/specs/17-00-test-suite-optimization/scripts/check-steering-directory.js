/**
 * Steering Directory Monitor
 * 
 * Checks .sce/steering/ directory for unauthorized files
 * that would be auto-loaded in every session.
 */

const fs = require('fs-extra');
const path = require('path');

// Allowed files in steering directory
const ALLOWED_FILES = [
  'CORE_PRINCIPLES.md',
  'ENVIRONMENT.md',
  'CURRENT_CONTEXT.md',
  'RULES_GUIDE.md'
];

// Allowed subdirectories (currently none)
const ALLOWED_SUBDIRS = [];

async function checkSteeringDirectory() {
  const steeringPath = path.join(process.cwd(), '.sce', 'steering');
  
  console.log('🔍 Checking .sce/steering/ directory...\n');
  
  if (!await fs.pathExists(steeringPath)) {
    console.log('❌ Error: .sce/steering/ directory not found');
    return false;
  }
  
  const entries = await fs.readdir(steeringPath, { withFileTypes: true });
  
  const unauthorizedFiles = [];
  const unauthorizedDirs = [];
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ALLOWED_SUBDIRS.includes(entry.name)) {
        unauthorizedDirs.push(entry.name);
      }
    } else if (entry.isFile()) {
      if (!ALLOWED_FILES.includes(entry.name)) {
        unauthorizedFiles.push(entry.name);
      }
    }
  }
  
  // Report results
  if (unauthorizedFiles.length === 0 && unauthorizedDirs.length === 0) {
    console.log('✅ Steering directory is clean!');
    console.log(`\nAllowed files (${ALLOWED_FILES.length}):`);
    ALLOWED_FILES.forEach(file => console.log(`  - ${file}`));
    return true;
  }
  
  console.log('⚠️  WARNING: Unauthorized content detected!\n');
  
  if (unauthorizedFiles.length > 0) {
    console.log(`❌ Unauthorized files (${unauthorizedFiles.length}):`);
    unauthorizedFiles.forEach(file => {
      const filePath = path.join(steeringPath, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  - ${file} (${sizeKB} KB)`);
    });
    console.log();
  }
  
  if (unauthorizedDirs.length > 0) {
    console.log(`❌ Unauthorized subdirectories (${unauthorizedDirs.length}):`);
    unauthorizedDirs.forEach(dir => console.log(`  - ${dir}/`));
    console.log();
  }
  
  console.log('📋 Recommendations:');
  console.log('  1. Move analysis reports to .sce/specs/{spec-name}/results/');
  console.log('  2. Move historical data to .sce/specs/{spec-name}/');
  console.log('  3. Move detailed documentation to docs/');
  console.log('  4. Delete temporary files');
  console.log();
  console.log('⚠️  Remember: All files in .sce/steering/ are auto-loaded in EVERY session!');
  console.log('   This increases token usage and slows down AI responses.');
  
  return false;
}

// Calculate total size of steering directory
async function calculateSteeringSize() {
  const steeringPath = path.join(process.cwd(), '.sce', 'steering');
  
  let totalSize = 0;
  const files = await fs.readdir(steeringPath);
  
  for (const file of files) {
    const filePath = path.join(steeringPath, file);
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

async function main() {
  const isClean = await checkSteeringDirectory();
  
  const totalSize = await calculateSteeringSize();
  const totalKB = (totalSize / 1024).toFixed(2);
  
  console.log(`\n📊 Total steering directory size: ${totalKB} KB`);
  
  if (totalSize > 50 * 1024) { // > 50 KB
    console.log('⚠️  Warning: Steering directory is large (> 50 KB)');
    console.log('   Consider reducing content to minimize session token usage.');
  }
  
  process.exit(isClean ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
