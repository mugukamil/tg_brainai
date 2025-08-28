#!/usr/bin/env tsx

/**
 * Setup verification script for TypeScript migration
 * Verifies that all dependencies are installed and configuration is correct
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

class SetupVerifier {
  private results: VerificationResult[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = resolve(process.cwd());
  }

  private addResult(result: VerificationResult): void {
    this.results.push(result);
  }

  private execCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf8', cwd: this.projectRoot });
    } catch (error) {
      throw new Error(`Command failed: ${command}`);
    }
  }

  private fileExists(path: string): boolean {
    return existsSync(join(this.projectRoot, path));
  }

  private readJsonFile(path: string): any {
    try {
      const content = readFileSync(join(this.projectRoot, path), 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  // Verify Node.js version
  private verifyNodeVersion(): void {
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

      if (majorVersion >= 16) {
        this.addResult({
          name: 'Node.js Version',
          status: 'pass',
          message: `Node.js ${nodeVersion} (✓ >= 16.0.0)`,
        });
      } else {
        this.addResult({
          name: 'Node.js Version',
          status: 'fail',
          message: `Node.js ${nodeVersion} (✗ < 16.0.0)`,
          details: 'Please upgrade to Node.js 16 or higher',
        });
      }
    } catch (error) {
      this.addResult({
        name: 'Node.js Version',
        status: 'fail',
        message: 'Could not detect Node.js version',
      });
    }
  }

  // Verify TypeScript installation
  private verifyTypeScript(): void {
    try {
      const version = this.execCommand('npx tsc --version').trim();
      this.addResult({
        name: 'TypeScript',
        status: 'pass',
        message: `${version} installed`,
      });
    } catch (error) {
      this.addResult({
        name: 'TypeScript',
        status: 'fail',
        message: 'TypeScript not found',
        details: 'Run: npm install -g typescript',
      });
    }
  }

  // Verify required files exist
  private verifyProjectStructure(): void {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      '.eslintrc.js',
      '.prettierrc',
      'src/index.ts',
      'src/types/index.ts',
      'src/tg-bot.ts',
      'src/handlers/msg-handler.ts',
    ];

    const requiredDirs = ['src', 'src/types', 'src/handlers'];

    let missingFiles = 0;
    let missingDirs = 0;

    requiredFiles.forEach(file => {
      if (!this.fileExists(file)) {
        missingFiles++;
        this.addResult({
          name: `File: ${file}`,
          status: 'fail',
          message: 'Missing required file',
        });
      }
    });

    requiredDirs.forEach(dir => {
      if (!this.fileExists(dir)) {
        missingDirs++;
        this.addResult({
          name: `Directory: ${dir}`,
          status: 'fail',
          message: 'Missing required directory',
        });
      }
    });

    if (missingFiles === 0 && missingDirs === 0) {
      this.addResult({
        name: 'Project Structure',
        status: 'pass',
        message: 'All required files and directories present',
      });
    }
  }

  // Verify package.json configuration
  private verifyPackageJson(): void {
    const pkg = this.readJsonFile('package.json');
    if (!pkg) {
      this.addResult({
        name: 'package.json',
        status: 'fail',
        message: 'package.json not found or invalid',
      });
      return;
    }

    // Check type module
    if (pkg.type === 'module') {
      this.addResult({
        name: 'ES Modules',
        status: 'pass',
        message: 'ES modules enabled in package.json',
      });
    } else {
      this.addResult({
        name: 'ES Modules',
        status: 'warn',
        message: 'ES modules not enabled',
        details: 'Add "type": "module" to package.json',
      });
    }

    // Check required dependencies
    const requiredDeps = [
      'fastify',
      'node-telegram-bot-api',
      'openai',
      'axios',
      '@supabase/supabase-js',
      'dotenv',
      'ngrok',
    ];

    const requiredDevDeps = [
      'typescript',
      '@types/node',
      'tsx',
      'eslint',
      'prettier',
      '@typescript-eslint/eslint-plugin',
      '@typescript-eslint/parser',
    ];

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const missing = [...requiredDeps, ...requiredDevDeps].filter(dep => !deps[dep]);

    if (missing.length === 0) {
      this.addResult({
        name: 'Dependencies',
        status: 'pass',
        message: 'All required dependencies found',
      });
    } else {
      this.addResult({
        name: 'Dependencies',
        status: 'fail',
        message: `Missing dependencies: ${missing.join(', ')}`,
        details: 'Run: npm install',
      });
    }

    // Check scripts
    const requiredScripts = ['build', 'dev', 'start', 'type-check'];
    const scripts = pkg.scripts || {};
    const missingScripts = requiredScripts.filter(script => !scripts[script]);

    if (missingScripts.length === 0) {
      this.addResult({
        name: 'npm Scripts',
        status: 'pass',
        message: 'All required scripts configured',
      });
    } else {
      this.addResult({
        name: 'npm Scripts',
        status: 'warn',
        message: `Missing scripts: ${missingScripts.join(', ')}`,
      });
    }
  }

  // Verify TypeScript configuration
  private verifyTypeScriptConfig(): void {
    const tsconfig = this.readJsonFile('tsconfig.json');
    if (!tsconfig) {
      this.addResult({
        name: 'tsconfig.json',
        status: 'fail',
        message: 'tsconfig.json not found or invalid',
      });
      return;
    }

    const requiredOptions = [
      'target',
      'module',
      'moduleResolution',
      'outDir',
      'rootDir',
      'strict',
      'esModuleInterop',
    ];

    const compilerOptions = tsconfig.compilerOptions || {};
    const missing = requiredOptions.filter(option => !compilerOptions[option]);

    if (missing.length === 0) {
      this.addResult({
        name: 'TypeScript Config',
        status: 'pass',
        message: 'TypeScript configuration looks good',
      });
    } else {
      this.addResult({
        name: 'TypeScript Config',
        status: 'warn',
        message: `Missing compiler options: ${missing.join(', ')}`,
      });
    }

    // Check for ES modules configuration
    if (compilerOptions.module === 'ESNext' && compilerOptions.moduleResolution === 'Node') {
      this.addResult({
        name: 'ES Modules Config',
        status: 'pass',
        message: 'ES modules configured in TypeScript',
      });
    } else {
      this.addResult({
        name: 'ES Modules Config',
        status: 'warn',
        message: 'ES modules not properly configured',
        details: 'Set module: "ESNext" and moduleResolution: "Node"',
      });
    }
  }

  // Test TypeScript compilation
  private verifyCompilation(): void {
    try {
      console.log('🔨 Testing TypeScript compilation...');
      this.execCommand('npx tsc --noEmit');
      this.addResult({
        name: 'TypeScript Compilation',
        status: 'pass',
        message: 'Code compiles without errors',
      });
    } catch (error) {
      this.addResult({
        name: 'TypeScript Compilation',
        status: 'fail',
        message: 'TypeScript compilation failed',
        details: 'Run "npx tsc --noEmit" to see detailed errors',
      });
    }
  }

  // Test linting
  private verifyLinting(): void {
    try {
      console.log('🔍 Testing ESLint...');
      this.execCommand('npx eslint src/**/*.ts --max-warnings 0');
      this.addResult({
        name: 'ESLint',
        status: 'pass',
        message: 'No linting errors found',
      });
    } catch (error) {
      this.addResult({
        name: 'ESLint',
        status: 'warn',
        message: 'Linting issues found',
        details: 'Run "npm run lint" to see details',
      });
    }
  }

  // Verify environment variables
  private verifyEnvironment(): void {
    const requiredVars = [
      'TELEGRAM_BOT_TOKEN',
      'OPENAI_API_KEY',
      'GOAPI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_KEY',
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length === 0) {
      this.addResult({
        name: 'Environment Variables',
        status: 'pass',
        message: 'All required environment variables set',
      });
    } else {
      this.addResult({
        name: 'Environment Variables',
        status: 'warn',
        message: `Missing variables: ${missing.join(', ')}`,
        details: 'Check your .env file',
      });
    }

    // Check for .env file
    if (this.fileExists('.env')) {
      this.addResult({
        name: '.env File',
        status: 'pass',
        message: '.env file found',
      });
    } else if (this.fileExists('.env.example')) {
      this.addResult({
        name: '.env File',
        status: 'warn',
        message: '.env not found, but .env.example exists',
        details: 'Copy .env.example to .env and configure',
      });
    } else {
      this.addResult({
        name: '.env File',
        status: 'fail',
        message: 'No .env or .env.example file found',
      });
    }
  }

  // Run all verifications
  public async verify(): Promise<void> {
    console.log('🔍 Verifying TypeScript setup...\n');

    this.verifyNodeVersion();
    this.verifyTypeScript();
    this.verifyProjectStructure();
    this.verifyPackageJson();
    this.verifyTypeScriptConfig();
    this.verifyEnvironment();
    this.verifyCompilation();
    this.verifyLinting();

    this.printResults();
  }

  // Print verification results
  private printResults(): void {
    console.log('\n📊 Verification Results:');
    console.log('━'.repeat(50));

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
      const color =
        result.status === 'pass' ? '\x1b[32m' : result.status === 'warn' ? '\x1b[33m' : '\x1b[31m';
      const reset = '\x1b[0m';

      console.log(`${icon} ${color}${result.name}${reset}: ${result.message}`);

      if (result.details) {
        console.log(`   💡 ${result.details}`);
      }

      switch (result.status) {
        case 'pass':
          passCount++;
          break;
        case 'warn':
          warnCount++;
          break;
        case 'fail':
          failCount++;
          break;
      }
    });

    console.log('\n📈 Summary:');
    console.log(`   ✅ Passed: ${passCount}`);
    console.log(`   ⚠️  Warnings: ${warnCount}`);
    console.log(`   ❌ Failed: ${failCount}`);

    if (failCount > 0) {
      console.log('\n❌ Setup verification failed. Please fix the issues above.');
      process.exit(1);
    } else if (warnCount > 0) {
      console.log('\n⚠️  Setup verification passed with warnings. Consider addressing them.');
    } else {
      console.log('\n🎉 Setup verification passed! Your TypeScript environment is ready.');
    }

    console.log('\n🚀 Next steps:');
    console.log('   npm run dev          # Start development server');
    console.log('   npm run dev:webhook  # Start webhook development');
    console.log('   npm run build        # Build for production');
    console.log('   npm run lint         # Check code quality');
    console.log('   npm run format       # Format code');
  }
}

// Run verification if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new SetupVerifier();
  verifier.verify().catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}

export { SetupVerifier };
