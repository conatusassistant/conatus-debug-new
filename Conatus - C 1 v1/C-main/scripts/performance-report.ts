#!/usr/bin/env node

/**
 * Performance Report Generator for Conatus
 *
 * This script collects performance metrics from the application and generates
 * a detailed HTML report highlighting any performance issues or areas for optimization.
 *
 * Usage:
 * npm run report:performance
 */

import { getPerformanceStats, checkPerformanceBudgets, PERFORMANCE_BUDGETS } from '../web/lib/performance';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

// Collection of performance data from various sources
interface PerformanceData {
  metrics: Record<string, {
    avg: number;
    min: number;
    max: number;
    count: number;
    p95: number;
  }>;
  budgetViolations: Array<{
    operation: string;
    budget: number;
    actual: number;
  }>;
  webVitals: {
    lcp?: number;
    fid?: number;
    cls?: number;
  };
}

async function main() {
  console.log(chalk.blue.bold('\n=== Conatus Performance Report Generator ===\n'));
  console.log(chalk.cyan('Collecting performance metrics...'));

  try {
    // Normally this would collect from actual app usage, but for now we'll use sample data
    // In a real app, this would connect to a data store or collect metrics from running instances
    const performanceData: PerformanceData = generateSamplePerformanceData();
    
    // Check performance budgets
    const budgetReport = checkPerformanceBudgets(performanceData.metrics);
    performanceData.budgetViolations = budgetReport.violations;
    
    // Generate the report
    console.log(chalk.cyan('Generating performance report...'));
    const reportHtml = generateHtmlReport(performanceData);
    
    // Save the report
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }
    
    const reportPath = path.join(reportDir, `performance-report-${new Date().toISOString().slice(0, 10)}.html`);
    fs.writeFileSync(reportPath, reportHtml);
    
    console.log(chalk.green.bold(`\n✓ Performance report generated at: ${reportPath}\n`));
    
    // Print summary to console
    console.log(chalk.cyan.bold('Performance Summary:'));
    console.log(chalk.cyan(`• Operations measured: ${Object.keys(performanceData.metrics).length}`));
    
    if (budgetReport.passes) {
      console.log(chalk.green('• All operations within performance budgets'));
    } else {
      console.log(chalk.red(`• Budget violations: ${budgetReport.violations.length}`));
      budgetReport.violations.forEach(violation => {
        console.log(chalk.red(`  - ${violation.operation}: ${violation.actual.toFixed(2)}ms (budget: ${violation.budget}ms)`));
      });
    }
    
    // Exit with appropriate code
    process.exit(budgetReport.passes ? 0 : 1);
  } catch (error) {
    console.error(chalk.red.bold('\n✗ Report generation failed with an error:\n'));
    console.error(chalk.red(error instanceof Error ? error.stack : String(error)));
    process.exit(1);
  }
}

function generateSamplePerformanceData(): PerformanceData {
  // This function simulates performance data collection
  // In a real implementation, this would come from telemetry or local measurements
  return {
    metrics: {
      'initial-load': {
        avg: 2500,
        min: 2100,
        max: 3200,
        count: 20,
        p95: 3100
      },
      'chat-response': {
        avg: 950,
        min: 800,
        max: 1300,
        count: 50,
        p95: 1200
      },
      'automation-creation': {
        avg: 420,
        min: 380,
        max: 620,
        count: 15,
        p95: 590
      },
      'suggestion-display': {
        avg: 180,
        min: 120,
        max: 250,
        count: 30,
        p95: 220
      },
      'navigation-transition': {
        avg: 280,
        min: 220,
        max: 450,
        count: 40,
        p95: 400
      }
    },
    budgetViolations: [],
    webVitals: {
      lcp: 2800,
      fid: 50,
      cls: 0.08
    }
  };
}

function generateHtmlReport(data: PerformanceData): string {
  const budgetViolations = data.budgetViolations.length > 0
    ? data.budgetViolations.map(v => `
      <tr class="budget-violation">
        <td>${v.operation}</td>
        <td>${v.budget} ms</td>
        <td>${v.actual.toFixed(2)} ms</td>
        <td>${((v.actual - v.budget) / v.budget * 100).toFixed(1)}% over budget</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="no-violations">No budget violations detected</td></tr>';

  const metricsRows = Object.entries(data.metrics).map(([operation, metrics]) => {
    const isBudgetViolation = data.budgetViolations.some(v => v.operation === operation);
    const rowClass = isBudgetViolation ? 'budget-violation' : '';
    
    return `
      <tr class="${rowClass}">
        <td>${operation}</td>
        <td>${metrics.avg.toFixed(2)} ms</td>
        <td>${metrics.min.toFixed(2)} ms</td>
        <td>${metrics.max.toFixed(2)} ms</td>
        <td>${metrics.p95.toFixed(2)} ms</td>
        <td>${metrics.count}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conatus Performance Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .report-header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .report-date {
      color: #7f8c8d;
      font-size: 1.1em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      text-align: left;
      background-color: #f8f9fa;
      padding: 12px;
      border-bottom: 2px solid #ddd;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #ddd;
    }
    .budget-violation {
      background-color: rgba(255, 82, 82, 0.1);
    }
    .no-violations {
      color: #27ae60;
      text-align: center;
      padding: 15px;
    }
    .summary-card {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .good-metric {
      color: #27ae60;
    }
    .warning-metric {
      color: #f39c12;
    }
    .bad-metric {
      color: #e74c3c;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
    }
    .metric-title {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .metric-value {
      font-size: 2em;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .recommendations {
      background-color: #fff8e1;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Conatus Performance Report</h1>
    <p class="report-date">Generated on ${new Date().toLocaleString()}</p>
  </div>

  <div class="summary-card">
    <h2>Executive Summary</h2>
    <p>
      This report presents performance metrics for the Conatus application, highlighting areas 
      that meet or exceed performance budgets.
    </p>
    <p>
      <strong>Budget violations: </strong>
      ${data.budgetViolations.length === 0 
        ? '<span class="good-metric">None detected</span>' 
        : `<span class="bad-metric">${data.budgetViolations.length} violations found</span>`}
    </p>
  </div>

  <h2>Core Web Vitals</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-title">Largest Contentful Paint (LCP)</div>
      <div class="metric-value ${data.webVitals.lcp && data.webVitals.lcp <= 2500 ? 'good-metric' : data.webVitals.lcp && data.webVitals.lcp <= 4000 ? 'warning-metric' : 'bad-metric'}">
        ${data.webVitals.lcp ? data.webVitals.lcp.toFixed(0) : 'N/A'} ms
      </div>
      <div>Target: < 2500ms</div>
    </div>
    <div class="metric-card">
      <div class="metric-title">First Input Delay (FID)</div>
      <div class="metric-value ${data.webVitals.fid && data.webVitals.fid <= 100 ? 'good-metric' : data.webVitals.fid && data.webVitals.fid <= 300 ? 'warning-metric' : 'bad-metric'}">
        ${data.webVitals.fid ? data.webVitals.fid.toFixed(0) : 'N/A'} ms
      </div>
      <div>Target: < 100ms</div>
    </div>
    <div class="metric-card">
      <div class="metric-title">Cumulative Layout Shift (CLS)</div>
      <div class="metric-value ${data.webVitals.cls && data.webVitals.cls <= 0.1 ? 'good-metric' : data.webVitals.cls && data.webVitals.cls <= 0.25 ? 'warning-metric' : 'bad-metric'}">
        ${data.webVitals.cls ? data.webVitals.cls.toFixed(2) : 'N/A'}
      </div>
      <div>Target: < 0.1</div>
    </div>
  </div>

  <h2>Performance Budget Violations</h2>
  <table>
    <thead>
      <tr>
        <th>Operation</th>
        <th>Budget</th>
        <th>Actual</th>
        <th>Overage</th>
      </tr>
    </thead>
    <tbody>
      ${budgetViolations}
    </tbody>
  </table>

  <h2>Detailed Performance Metrics</h2>
  <table>
    <thead>
      <tr>
        <th>Operation</th>
        <th>Average</th>
        <th>Min</th>
        <th>Max</th>
        <th>P95</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      ${metricsRows}
    </tbody>
  </table>

  <div class="recommendations">
    <h2>Optimization Recommendations</h2>
    <ul>
      ${data.budgetViolations.map(v => {
        if (v.operation === 'initial-load') {
          return `<li>Reduce initial load time by implementing code splitting, optimizing images, and reducing bundle size.</li>`;
        } else if (v.operation === 'chat-response') {
          return `<li>Improve chat response time by optimizing API calls and implementing streaming responses.</li>`;
        } else if (v.operation === 'automation-creation') {
          return `<li>Optimize automation creation by improving form validation and submission process.</li>`;
        } else if (v.operation === 'suggestion-display') {
          return `<li>Speed up suggestion display by implementing virtualization for long lists and optimizing rendering.</li>`;
        } else if (v.operation === 'navigation-transition') {
          return `<li>Improve navigation transitions by implementing preloading and optimizing layout calculations.</li>`;
        } else {
          return `<li>Investigate and optimize the ${v.operation} operation which is exceeding its performance budget.</li>`;
        }
      }).join('') || '<li>All operations are currently within performance budgets. Continue monitoring for any regressions.</li>'}
    </ul>
  </div>

  <footer style="margin-top: 50px; text-align: center; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 20px;">
    <p>Conatus AI Performance Report - Generated by performance-report.ts</p>
  </footer>
</body>
</html>
  `;
}

main();
