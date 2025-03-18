#!/usr/bin/env node

/**
 * Integration Testing Script for Conatus
 * 
 * This script runs all end-to-end tests and provides a detailed report
 * of any issues or integration gaps found in the application.
 * 
 * Usage: 
 * npm run test:integration
 */

import { runAllTests } from '../web/lib/testing/e2eTests';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue.bold('\n=== Conatus Integration Testing ===\n'));
  console.log(chalk.cyan('Running comprehensive tests for all major components...'));
  
  try {
    const results = await runAllTests();
    
    if (results.failedTests === 0) {
      console.log(chalk.green.bold('\n✓ All tests passed successfully!\n'));
    } else {
      console.log(chalk.red.bold(`\n✗ ${results.failedTests} of ${results.totalTests} tests failed!\n`));
      
      // Print detailed failures
      results.results
        .filter(result => !result.success)
        .forEach(failure => {
          console.log(chalk.red(`• ${failure.name}:`));
          console.log(chalk.red(`  - ${failure.error}`));
          if (failure.details) {
            console.log(chalk.gray('  Details:'));
            console.log(chalk.gray(JSON.stringify(failure.details, null, 2)));
          }
          console.log('');
        });
    }
    
    // Print summary
    console.log(chalk.cyan.bold('Test Summary:'));
    console.log(chalk.cyan(`• Total Tests: ${results.totalTests}`));
    console.log(chalk.green(`• Passed: ${results.passedTests}`));
    console.log(chalk.red(`• Failed: ${results.failedTests}`));
    
    // Exit with appropriate code
    process.exit(results.failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error(chalk.red.bold('\n✗ Testing failed with an error:\n'));
    console.error(chalk.red(error instanceof Error ? error.stack : String(error)));
    process.exit(1);
  }
}

main();
