console.error('[isolated-chrome] Deprecated.');
console.error('[isolated-chrome] --isolated=true creates a new browser per LLM session and can leak memory.');
console.error('[isolated-chrome] Use one of these instead:');
console.error('  docs/chrome_split/chrome_devtools_manager.command setup --workspace docs');
console.error('  docs/chrome_split/chrome_devtools_manager.command setup --workspace mejai');
process.exit(1);
