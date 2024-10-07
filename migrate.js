#!/usr/bin/env node

// Import required modules
const program = require('commander');
const fs = require('fs').promises;
const { glob } = require("glob");
const cheerio = require('cheerio');
const acorn = require('acorn');

// Define the command-line interface using Commander
program
  .version('1.0.0')
  .description('Migration tool for Angular Flex layout to Tailwind CSS')
  .option('-p, --path <path>', 'Path to folder containing HTML files')
  .option('-r, --recursive [value]', 'Recursively process sub-folders', true)
  .parse(process.argv);

// Initialize variables
let inputPath;
let finalPath;
const options = program.opts();

// Determine the input path based on provided options
if (options.path && options.recursive) {
  inputPath = getFinalPath(options.path);
  inputPath += "/**/*.html";  // Recursive glob pattern
} else if (!options.path && options.recursive) {
  inputPath = './**/*.html';  // Default recursive pattern
} else {
  inputPath = './*.html';  // Default non-recursive pattern
}

// Resolve the absolute path
function getFinalPath(inputPath) {
  const path = require('path');
  return path.resolve(inputPath);
}

// Main function to loop over HTML templates and apply conversions
async function loopOverTemplates() {
  try {
    const templates = await glob(inputPath, { ignore: 'node_modules/**' });

    for (const templatePath of templates) {
      console.info(`Processing file: ${templatePath}`);

      const contents = await fs.readFile(templatePath, 'utf8');
      const $ = cheerio.load(contents, {
        xmlMode: true,
        decodeEntities: false,
        normalizeWhitespace: false,
        selfClosingTags: false,
      });

      // Apply migration functions
      handleFxLayout($);
      handleResponsiveFxLayout($);
      migrateFxLayoutAlignToTailwind($);
      migrateFxLayoutGapToTailwind($);
      migrateFxFlexToTailwind($);
      migrateFlexFillToTailwind($);

      // Save the modified HTML
      const outputPath = finalPath || templatePath;
      await fs.writeFile(outputPath, $.html({ xmlMode: true }), { encoding: 'utf-8' });
    }

    console.log("Processing completed");
  } catch (error) {
    console.error("Error processing templates:", error);
  }
}

// Execute the main function
loopOverTemplates();

// Function to migrate fxLayout attribute to Tailwind classes
function handleFxLayout(element) {
  const $ = element;
  const layoutMap = {
    'row': 'flex-row',
    'column': 'flex-col',
    'row wrap': 'flex-row flex-wrap',
    'wrap row': 'flex-row flex-wrap',
    'column wrap': 'flex-col flex-wrap',
    'wrap column': 'flex-col flex-wrap'
  };

  $(`[fxLayout], [\\[fxLayout\\]]`).each((index, element) => {
    const layoutValues = $(element).attr('fxLayout') || $(element).attr('[fxLayout]');
    $(element).removeAttr('fxLayout [fxLayout]');
    $(element).addClass(`flex ${layoutMap[layoutValues]}`);
  });
}

// Function to mark unresolved responsive fxLayout attributes
function handleResponsiveFxLayout(element) {
  const $ = element;
  $(`[fxLayout\\.sm], [fxLayout\\.xs], [fxLayout\\.md], [fxLayout\\.lg], [fxLayout\\.xl]`).each((index, element) => {
    $(element).before(`\n<!-- TODO: Responsive API migration is not handled, please migrate manually. -->\n`);
  });
}

// Function to migrate fxLayoutAlign attribute to Tailwind classes
function migrateFxLayoutAlignToTailwind(element) {
  const $ = element;
  const alignMap = {
    start: { mainAxis: 'justify-start', crossAxis: 'items-start' },
    end: { mainAxis: 'justify-end', crossAxis: 'items-end' },
    center: { mainAxis: 'justify-center', crossAxis: 'items-center' },
    'space-between': { mainAxis: 'justify-between', crossAxis: 'items-center' },
    'space-around': { mainAxis: 'justify-around', crossAxis: 'items-center' },
    'space-evenly': { mainAxis: 'justify-evenly', crossAxis: 'items-center' },
    stretch: { mainAxis: 'justify-start', crossAxis: 'items-stretch' },
    baseline: { mainAxis: 'justify-start', crossAxis: 'items-baseline' },
  };

  $('[fxLayoutAlign], [\\[fxLayoutAlign\\]]').each((index, element) => {
    const alignValue = $(element).attr('fxLayoutAlign') || $(element).attr('[fxLayoutAlign]');

    // Handle ternary operators
    if (alignValue && alignValue.includes('?')) {
      $(element).before(`\n<!-- TODO: Ternary operators need manual migration -->\n`);
      const ternary = extractTernaryValues(alignValue);
      const truthyClass = alignMap[ternary.truthy]?.mainAxis + ' ' + alignMap[ternary.truthy]?.crossAxis;
      const falsyClass = alignMap[ternary.falsy]?.mainAxis + ' ' + alignMap[ternary.falsy]?.crossAxis;
      const ngClass = `{'${ternary.condition.trim()}': '${truthyClass}', '!${ternary.condition.trim()}': '${falsyClass}'}`;
      $(element).attr('ngClass', ngClass);
    } else {
      // Regular case
      const [mainAxis, crossAxis] = alignValue.split(' ');
      const mainAxisClass = alignMap[mainAxis]?.mainAxis || '';
      const crossAxisClass = alignMap[crossAxis]?.crossAxis || '';
      $(element).addClass(`${mainAxisClass} ${crossAxisClass} flex flex-row`);
    }

    $(element).removeAttr('fxLayoutAlign [fxLayoutAlign]');
  });
}

// Function to migrate fxLayoutGap attribute to Tailwind classes
function migrateFxLayoutGapToTailwind(element) {
  const $ = element;
  $('[fxLayoutGap], [\\[fxLayoutGap\\]]').each((index, element) => {
    const gapValue = $(element).attr('fxLayoutGap') || $(element).attr('[fxLayoutGap]');

    if (gapValue.includes('?')) {
      $(element).before(`\n<!-- TODO: fxLayoutGap with ternary operators needs manual migration -->\n`);
    } else {
      $(element).addClass(`gap-[${gapValue}]`);
    }

    $(element).removeAttr('fxLayoutGap [fxLayoutGap]');
  });
}

// Function to migrate fxFlex attribute to Tailwind classes
function migrateFxFlexToTailwind(element) {
  const $ = element;
  $('[fxFlex], [\\[fxFlex\\]]').each((index, element) => {
    let flexValue = $(element).attr('fxFlex') || $(element).attr('[fxFlex]');
    if (!flexValue) {
      $(element).addClass('flex-[1_1_0%] box-border');
    } else if (flexValue.includes('?')) {
      const ternary = extractTernaryValues(flexValue);
      const ngClass = `{${ternary.condition.trim()}: '${convertFlex(ternary.truthy)}', !${ternary.condition.trim()}: '${convertFlex(ternary.falsy)}'}`;
      $(element).attr('ngClass', ngClass);
    } else {
      $(element).addClass(`${convertFlex(flexValue)} box-border`);
      if (flexValue.includes('100%')) {
        $(element).addClass('max-w-[100%]');
      }
    }

    $(element).removeAttr('fxFlex [fxFlex]');
  });
}

// Utility function to convert flex values to Tailwind format
function convertFlex(flexValue) {
  flexValue = stringConversion(flexValue);
  if (flexValue === 'auto') {
    return 'flex-[1_1_auto]';
  } else if (flexValue.includes('%') || flexValue.includes('px') || flexValue.includes('rem')) {
    return `flex-[1_1_${flexValue}]`;
  } else if (flexValue === "none") {
    return 'flex-[0_0_auto]';
  } else if (flexValue === "grow" || flexValue === "100") {
    return 'flex-[1_1_100%]';
  } else {
     const [flexGrow, flexShrink, flexBasis] = flexValue.split(' ');
    if(flexGrow && flexShrink && flexBasis){
        return 'flex-[' + flexGrow + '_' + flexShrink + '_' + flexBasis + '%]';
    }
    return 'flex-[1_1_' + flexGrow + '%]';
  }
}

// Utility function to strip quotes from a string
function stringConversion(input) {
  return input.replace(/^'|'$/g, '');
}

// Function to migrate fxFlexFill attribute to Tailwind classes
function migrateFlexFillToTailwind(element) {
  const $ = element;
  $('[fxFill], [fxFlexFill], [\\[fxFlexFill\\]], [\\[fxFill\\]]').each((index, element) => {
    $(element).removeAttr('fxFlexFill [fxFlexFill] fxFill [fxFill]');
    $(element).addClass('w-full h-full min-w-full min-h-full box-border');
  });
}

// Function to extract ternary values from expressions
function extractTernaryValues(expression) {
  const ast = acorn.parse(expression, { ecmaVersion: 'latest' });
  function traverse(node) {
    if (node.type === 'ConditionalExpression') {
      const condition = expression.substring(node.test.start, node.test.end);
      const truthyValue = expression.substring(node.consequent.start, node.consequent.end);
      const falsyValue = expression.substring(node.alternate.start, node.alternate.end);
      return { condition: condition.trim(), truthy: truthyValue.trim(), falsy: falsyValue.trim() };
    }
    return null;
  }
  const result = traverse(ast.body[0].expression);
  if (!result) throw new Error('Invalid ternary expression format');
  return result;
}
