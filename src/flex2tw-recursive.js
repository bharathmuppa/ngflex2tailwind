#!/usr/bin/env node

// Required modules
const program = require('commander');
const fs = require('fs').promises;
const { glob } = require("glob");
const cheerio = require('cheerio');
const { parse } = require('@typescript-eslint/parser'); // Using @typescript-eslint/parser for modern TypeScript syntax parsing

// Setup CLI tool using Commander
program
  .version('1.0.0')
  .description('Tool to migrate Angular Flex layout to Tailwind CSS')
  .option('-p, --path <path>', 'Path to folder containing HTML files')
  .option('-r, --recursive [value]', 'Process sub-folders recursively', true)
  .parse(process.argv);

// Main migration logic
(async function migrateTemplates() {
  try {
    const options = program.opts();
    const inputPath = resolveInputPath(options);

    // Get HTML files using glob pattern
    const templates = await glob(inputPath, { ignore: 'node_modules/**' });

    for (const templatePath of templates) {
      console.log(`Processing: ${templatePath}`);

      const contents = await fs.readFile(templatePath, 'utf8');
      const $ = cheerio.load(contents, { xmlMode: true, decodeEntities: false });

      // Apply migration functions
      handleFxLayout($);
      handleResponsiveFxLayout($);
      migrateFxLayoutAlign($);
      migrateFxLayoutGap($);
      migrateFxFlex($);
      migrateFxFill($);

      // Save modified file
      await fs.writeFile(templatePath, $.html(), 'utf8');
    }

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Error:", error);
  }
})();

// Helper function to resolve input path based on CLI options
function resolveInputPath(options) {
  const path = require('path');
  return options.path ? path.resolve(options.path) + "/**/*.html" : './**/*.html';
}

// Migration functions

/**
 * Converts fxLayout to Tailwind flex classes
 * @param {Object} $ - Cheerio instance
 */
function handleFxLayout($) {
  const layoutMap = {
    'row': 'flex-row',
    'column': 'flex-col',
    'row wrap': 'flex-row flex-wrap',
    'column wrap': 'flex-col flex-wrap'
  };

  $(`[fxLayout]`).each((_, element) => {
    const layout = $(element).attr('fxLayout');
    $(element).removeAttr('fxLayout').addClass(`flex ${layoutMap[layout]}`);
  });
}

/**
 * Marks unresolved responsive fxLayout attributes for manual migration
 * @param {Object} $ - Cheerio instance
 */
function handleResponsiveFxLayout($) {
  const responsiveLayouts = ['fxLayout.sm', 'fxLayout.xs', 'fxLayout.md', 'fxLayout.lg', 'fxLayout.xl'];

  responsiveLayouts.forEach(attr => {
    $(`[${attr}]`).before(`\n<!-- TODO: Manually handle responsive layout (${attr}) -->\n`);
  });
}

/**
 * Converts fxLayoutAlign to Tailwind alignment classes
 * @param {Object} $ - Cheerio instance
 */
function migrateFxLayoutAlign($) {
  const alignMap = {
    start: { main: 'justify-start', cross: 'items-start' },
    end: { main: 'justify-end', cross: 'items-end' },
    center: { main: 'justify-center', cross: 'items-center' },
    'space-between': { main: 'justify-between', cross: 'items-center' },
    'space-around': { main: 'justify-around', cross: 'items-center' },
    'space-evenly': { main: 'justify-evenly', cross: 'items-center' }
  };

  $(`[fxLayoutAlign]`).each((_, element) => {
    const alignValue = $(element).attr('fxLayoutAlign');

    // Handle ternary operators using extractTernaryValues function
    if (alignValue.includes('?')) {
      const ternary = extractTernaryValues(alignValue);
      const mainClassTruthy = alignMap[ternary.truthy.split(' ')[0]]?.main || '';
      const crossClassTruthy = alignMap[ternary.truthy.split(' ')[1]]?.cross || '';
      const mainClassFalsy = alignMap[ternary.falsy.split(' ')[0]]?.main || '';
      const crossClassFalsy = alignMap[ternary.falsy.split(' ')[1]]?.cross || '';

      const ngClass = `{'${ternary.condition}': '${mainClassTruthy} ${crossClassTruthy}', '!${ternary.condition}': '${mainClassFalsy} ${crossClassFalsy}'}`;
      $(element).attr('ngClass', ngClass).removeAttr('fxLayoutAlign');
    } else {
      const [mainAxis, crossAxis] = alignValue.split(' ');
      $(element).removeAttr('fxLayoutAlign').addClass(`${alignMap[mainAxis]?.main} ${alignMap[crossAxis]?.cross || ''} flex`);
    }
  });
}

/**
 * Converts fxLayoutGap to Tailwind gap classes
 * @param {Object} $ - Cheerio instance
 */
function migrateFxLayoutGap($) {
  $(`[fxLayoutGap]`).each((_, element) => {
    const gapValue = $(element).attr('fxLayoutGap');
    $(element).removeAttr('fxLayoutGap').addClass(`gap-${gapValue}`);
  });
}

/**
 * Converts fxFlex to Tailwind flex-grow/shrink/basis classes
 * @param {Object} $ - Cheerio instance
 */
function migrateFxFlex($) {
  $(`[fxFlex]`).each((_, element) => {
    const flexValue = $(element).attr('fxFlex');
    const flexClass = convertFlexToTailwind(flexValue);

    // Handle ternary operators using extractTernaryValues function
    if (flexValue.includes('?')) {
      const ternary = extractTernaryValues(flexValue);
      const flexClassTruthy = convertFlexToTailwind(ternary.truthy);
      const flexClassFalsy = convertFlexToTailwind(ternary.falsy);

      const ngClass = `{'${ternary.condition}': '${flexClassTruthy}', '!${ternary.condition}': '${flexClassFalsy}'}`;
      $(element).attr('ngClass', ngClass).removeAttr('fxFlex');
    } else {
      $(element).removeAttr('fxFlex').addClass(flexClass);
    }
  });
}

/**
 * Converts fxFill/fxFlexFill to Tailwind full width/height classes
 * @param {Object} $ - Cheerio instance
 */
function migrateFxFill($) {
  $(`[fxFill], [fxFlexFill]`).each((_, element) => {
    $(element).removeAttr('fxFill fxFlexFill').addClass('w-full h-full');
  });
}

/**
 * Converts fxFlex values to Tailwind-compatible flex classes
 * @param {String} flexValue - fxFlex value
 * @returns {String} Tailwind flex class
 */
function convertFlexToTailwind(flexValue) {
  if (!flexValue || flexValue === 'auto') return 'flex-auto';
  if (flexValue === 'none') return 'flex-none';
  if (flexValue.includes('%')) return `flex-[1_1_${flexValue}]`;
  const [grow, shrink, basis] = flexValue.split(' ');
  return `flex-[${grow}_${shrink}_${basis}]`;
}

/**
 * Recursively parses ternary expressions and handles nested ternaries.
 * @param {String} expression - Expression to parse
 * @returns {Object} Parsed ternary values
 */
function extractTernaryValues(expression) {
  const ast = parse(expression, { ecmaVersion: 'latest', sourceType: 'module' });

  // Recursive traversal function to handle nested ternary expressions
  function traverse(node) {
    if (node.type === 'ConditionalExpression') {
      const condition = expression.substring(node.test.start, node.test.end).trim();
      const truthy = expression.substring(node.consequent.start, node.consequent.end).trim();
      const falsy = expression.substring(node.alternate.start, node.alternate.end).trim();

      // Check if truthy or falsy values contain nested ternary operators
      const truthyNode = parse(truthy, { ecmaVersion: 'latest', sourceType: 'module' }).body[0].expression;
      const falsyNode = parse(falsy, { ecmaVersion: 'latest', sourceType: 'module' }).body[0].expression;

      return {
        condition,
        truthy: truthyNode.type === 'ConditionalExpression' ? traverse(truthyNode) : truthy,
        falsy: falsyNode.type === 'ConditionalExpression' ? traverse(falsyNode) : falsy
      };
    }
    return null;
  }

  const result = traverse(ast.body[0].expression);
  if (!result) throw new Error('Invalid ternary expression format');

  return result;
}
