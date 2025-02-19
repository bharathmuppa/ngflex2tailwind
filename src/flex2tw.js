#!/usr/bin/env node

// Import required modules
const program = require('commander');
const fs = require('fs').promises;
const { glob } = require("glob");
const cheerio = require('cheerio');
const { parse } = require('@typescript-eslint/parser'); // Using @typescript-eslint/parser for advanced syntax parsing

// Define the command-line interface using Commander
program
  .version('1.0.0')
  .description('Migration tool for Angular Flex layout to Tailwind CSS')
  .option('-p, --path <path>', 'Path to folder containing HTML files')
  .option('-r, --recursive [value]', 'Recursively process sub-folders', 'true')
  .parse(process.argv);

// Initialize variables
let inputPath;
let finalPath;
const options = program.opts();
let $;
// Determine the input path based on provided options
inputPath = options.path ? getFinalPath(options.path) : '.';
if (options.recursive === 'true') {
  inputPath = inputPath + '/**/*.html'
} else {
  inputPath = inputPath + '/*.html'
}

// Resolve the absolute path
function getFinalPath(inputPath) {
  const path = require('path');
  return path.resolve(inputPath);
}

// Main function to loop over HTML templates and apply conversions
async function loopOverTemplates() {
  try {
    const templates = await glob(inputPath, {ignore: 'node_modules/**'});

    for (const templatePath of templates) {
      console.info(`Processing file: ${templatePath}`);

      const contents = await fs.readFile(templatePath, 'utf8');
      $ = cheerio.load(contents, {
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
      await fs.writeFile(outputPath, $.html({xmlMode: true}), {encoding: 'utf-8'});
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
    'wrap column': 'flex-col flex-wrap',
    'row-reverse': 'flex-row-reverse',
    'column-reverse': 'flex-col-reverse', // corrected mapping
  };

  $(`[fxLayout], [\\[fxLayout\\]]`).each((index, elem) => {
    const layoutValues = $(elem).attr('fxLayout') || $(elem).attr('[fxLayout]');
    if (layoutValues && layoutValues.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary operators need careful migration, before conversion it was: ${layoutValues} -->\n`);
      const ternary = extractTernaryValues(layoutValues);
      const condition = ternary.condition.trim();
      const truthyClass = `flex ${layoutMap[ternary.truthy]}`;
      const falsyClass = `flex ${layoutMap[ternary.falsy]}`;
      // Set [ngClass] with array syntax and a single ternary expression
      $(elem).attr('[ngClass]', `[${condition} ? '${truthyClass}' : '${falsyClass}']`);
    } else {
      $(elem).addClass(`flex ${layoutMap[layoutValues]}`);
    }
    $(elem).removeAttr('fxLayout [fxLayout]');
  });
}

// Function to mark unresolved responsive fxLayout attributes
function handleResponsiveFxLayout(element) {
  const $ = element;
  $(`[fxLayout\\.sm], [fxLayout\\.xs], [fxLayout\\.md], [fxLayout\\.lg], [fxLayout\\.xl]`).each((index, elem) => {
    $(elem).before(`\n<!-- TODO: Responsive API migration is not handled, please migrate manually. -->\n`);
  });
}

// Function to migrate fxLayoutAlign attribute to Tailwind classes
function migrateFxLayoutAlignToTailwind(element) {
  const $ = element;
  const alignMap = {
    start: {mainAxis: 'justify-start', crossAxis: 'items-start'},
    end: {mainAxis: 'justify-end', crossAxis: 'items-end'},
    center: {mainAxis: 'justify-center', crossAxis: 'items-center'},
    'space-between': {mainAxis: 'justify-between', crossAxis: 'items-center'},
    'space-around': {mainAxis: 'justify-around', crossAxis: 'items-center'},
    'space-evenly': {mainAxis: 'justify-evenly', crossAxis: 'items-center'},
    stretch: {mainAxis: 'justify-start', crossAxis: 'items-stretch'},
    baseline: {mainAxis: 'justify-start', crossAxis: 'items-baseline'},
  };

  $('[fxLayoutAlign], [\\[fxLayoutAlign\\]]').each((index, elem) => {
    const alignValue = $(elem).attr('fxLayoutAlign') || $(elem).attr('[fxLayoutAlign]');
    if (alignValue && alignValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary operators need careful migration, before conversion it was: ${alignValue} -->\n`);
      const ternary = extractTernaryValues(alignValue);
      const condition = ternary.condition.trim();

      // Process truthy and falsy values (assumed to be space-separated)
      const truthyValues = ternary.truthy.replace(/'/g, "").split(" ").filter(Boolean);
      const falsyValues = ternary.falsy.replace(/'/g, "").split(" ").filter(Boolean);
      const truthyMainClass = truthyValues[0] && alignMap[truthyValues[0]] ? alignMap[truthyValues[0]].mainAxis : '';
      const truthyCrossClass = truthyValues[1] && alignMap[truthyValues[1]] ? alignMap[truthyValues[1]].crossAxis : '';
      const falsyMainClass = falsyValues[0] && alignMap[falsyValues[0]] ? alignMap[falsyValues[0]].mainAxis : '';
      const falsyCrossClass = falsyValues[1] && alignMap[falsyValues[1]] ? alignMap[falsyValues[1]].crossAxis : '';
      const truthyClass = `flex ${truthyMainClass} ${truthyCrossClass}`;
      const falsyClass = `flex ${falsyMainClass} ${falsyCrossClass}`;
      $(elem).attr('[ngClass]', `[${condition} ? '${truthyClass}' : '${falsyClass}']`);
    } else {
      const [mainAxis, crossAxis] = alignValue.replace(/'/g, "").split(" ");
      const mainAxisClass = alignMap[mainAxis]?.mainAxis || '';
      const crossAxisClass = alignMap[crossAxis]?.crossAxis || '';
      $(elem).addClass(`${mainAxisClass} ${crossAxisClass} flex`);
    }
    $(elem).removeAttr('fxLayoutAlign [fxLayoutAlign]');
  });
}

// Function to migrate fxLayoutGap attribute to Tailwind classes
function migrateFxLayoutGapToTailwind(element) {
  const $ = element;
  $('[fxLayoutGap], [\\[fxLayoutGap\\]]').each((index, elem) => {
    const gapValue = $(elem).attr('fxLayoutGap') || $(elem).attr('[fxLayoutGap]');
    if (gapValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary operators need careful migration, before conversion it was: ${gapValue} -->\n`);
      const ternary = extractTernaryValues(gapValue);
      const condition = ternary.condition.trim();
      // Process each part to extract only the gap size (exclude extra words like "grid")
      const truthySize = ternary.truthy.split(' ')[0];
      const falsySize = ternary.falsy.split(' ')[0];
      const truthyClass = `gap-[${truthySize}]`;
      const falsyClass = `gap-[${falsySize}]`;
      $(elem).attr('[ngClass]', `[${condition} ? '${truthyClass}' : '${falsyClass}']`);
    } else {
      // Process non-ternary value: use the first token as the gap size
      const gapSize = gapValue.split(' ')[0];
      $(elem).addClass(`gap-[${gapSize}]`);
    }
    $(elem).removeAttr('fxLayoutGap [fxLayoutGap]');
  });
}

// Function to migrate fxFlex attribute to Tailwind classes
function migrateFxFlexToTailwind(element) {
  const $ = element;
  $('[fxFlex], [\\[fxFlex\\]]').each((index, elem) => {
    let flexValue = $(elem).attr('fxFlex') || $(elem).attr('[fxFlex]');
    if (!flexValue) {
      $(elem).addClass('flex-[1_1_0%] box-border');
    } else if (flexValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary operators need careful migration, before conversion it was: ${flexValue} -->\n`);
      const ternary = extractTernaryValues(flexValue);
      const condition = ternary.condition.trim();
      let truthyClass = `${convertFlex(ternary.truthy)} box-border`;
      let falsyClass = `${convertFlex(ternary.falsy)} box-border`;
      if (ternary.truthy.includes('100%')) {
        truthyClass += ' max-w-[100%]';
      }
      if (ternary.falsy.includes('100%')) {
        falsyClass += ' max-w-[100%]';
      }
      $(elem).attr('[ngClass]', `[${condition} ? '${truthyClass}' : '${falsyClass}']`);
    } else {
      const flexClass = `${convertFlex(flexValue)} box-border`;
      $(elem).addClass(flexClass);
      if (flexValue.includes('100%')) {
        $(elem).addClass('max-w-[100%]');
      }
    }
    $(elem).removeAttr('fxFlex [fxFlex]');
  });
}

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
    if (flexGrow && flexShrink && flexBasis) {
      return flexBasis === 'auto'
        ? `flex-[${flexGrow}_${flexShrink}_${flexBasis}]`
        : `flex-[${flexGrow}_${flexShrink}_${flexBasis}%]`;
    }
    return flexGrow === 'auto'
      ? `flex-[1_1_${flexGrow}]`
      : `flex-[1_1_${flexGrow}%]`;
  }
}

// Function to migrate fxFlexFill attribute to Tailwind classes
function migrateFlexFillToTailwind(element) {
  const $ = element;
  $('[fxFill], [fxFlexFill], [\\[fxFlexFill\\]], [\\[fxFill\\]]').each((index, elem) => {
    let flexValue = $(elem).attr('fxFill') || $(elem).attr('[fxFill]') || $(elem).attr('fxFlexFill') || $(elem).attr('[fxFlexFill]');
    $(elem).before(`\n<!-- TODO: Check the below conversion, use git compare to see the difference-->\n`);
    $(elem).removeAttr('fxFlexFill [fxFlexFill] fxFill [fxFill]');
    $(elem).addClass('w-full h-full min-w-full min-h-full box-border');
  });
}

/**
 * Extracts the condition, truthy value, and falsy value from a ternary expression.
 *
 * @param {string} expression - The ternary expression as a string.
 * @returns {Object} An object containing the condition, truthy value, and falsy value.
 * @throws Will throw an error if the expression is not a valid ternary expression.
 */
function extractTernaryValues(expression) {
  // Parse the input expression into an AST using the TypeScript ESLint parser.
  const ast = parse(expression, { ecmaVersion: 'latest', sourceType: 'module' });

  /**
   * Recursively traverses the AST node to extract ternary expression parts.
   *
   * @param {Object} node - The AST node to be traversed.
   * @returns {Object|null} An object containing the ternary condition, truthy, and falsy values.
   */
  function extractFromNode(node) {
    if (node.type === 'ConditionalExpression') {
      const condition = extractTest(node.test);
      const truthyValue = extractValue(node.consequent);
      const falsyValue = extractValue(node.alternate);
      return {
        condition: condition.trim()?.split("'").join("'"),
        truthy: truthyValue.trim(),
        falsy: falsyValue.trim()
      };
    }
    return null;
  }

  function extractTest(testNode) {
    if (testNode.type === 'BinaryExpression') {
      const left = extractValue(testNode.left);
      const operator = testNode.operator;
      const right = extractValue(testNode.right);
      return `${left} ${operator} ${right}`;
    } else if (testNode.type === 'ChainExpression') {
      return extractValue(testNode.expression);
    } else if (testNode.type === 'MemberExpression') {
      const object = extractValue(testNode.object);
      const property = testNode.property.name || extractValue(testNode.property);
      return `${object}${testNode.optional ? '?.' : '.'}${property}`;
    }
    return extractValue(testNode);
  }

  function extractValue(valueNode) {
    if (valueNode.type === 'Identifier') {
      return valueNode.name;
    } else if (valueNode.type === 'Literal') {
      return valueNode.raw;
    } else if (valueNode.type === 'MemberExpression') {
      const object = extractValue(valueNode.object);
      const property = valueNode.property.name || extractValue(valueNode.property);
      return `${object}${valueNode.optional ? '?.' : '.'}${property}`;
    }
    return expression.substring(valueNode.range[0], valueNode.range[1]);
  }

  const result = extractFromNode(ast.body[0].expression);
  if (!result) {
    throw new Error('Invalid ternary expression format');
  }
  return result;
}

// Old function retained if needed for non-ternary appending
function appendNgClass(element, className, condition) {
  let existingNgClass = $(element).attr('[ngClass]') || '{}';
  if (existingNgClass === '{}') {
    existingNgClass = `{}`;
  }
  existingNgClass = existingNgClass.replace(/^\{|\}$/g, '').trim();
  const newClassEntry = `'${className}': ${condition}`;
  if (existingNgClass === '') {
    existingNgClass = `{${newClassEntry}}`;
  } else {
    existingNgClass = `{${existingNgClass}, ${newClassEntry}}`;
  }
  $(element).attr('[ngClass]', existingNgClass);
}

// Utility function to strip quotes from a string
function stringConversion(input) {
  return input.replace(/^'|'$/g, '');
}
