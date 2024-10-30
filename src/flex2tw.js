#!/usr/bin/env node

// Import required modules
const program = require('commander');
const fs = require('fs').promises;
const {glob} = require("glob");
const cheerio = require('cheerio');
const {parse} = require('@typescript-eslint/parser'); // Using @typescript-eslint/parser for advanced syntax parsing

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
if(options.recursive==='true'){
    inputPath = inputPath+'/**/*.html'
} else {
    inputPath = inputPath+'/*.html'
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
    'column-reverse': 'flex-column-reverse',
  };

  $(`[fxLayout], [\\[fxLayout\\]]`).each((index, element) => {
    const layoutValues = $(element).attr('fxLayout') || $(element).attr('[fxLayout]');

    if (layoutValues && layoutValues.includes('?')) {
      $(element).before(`\n<!-- TODO: Ternary operators need carefull migration, before conversion it was: ${alignValue} -->\n`);
      const ternary = extractTernaryValues(alignValue);
      const truthyClass = layoutMap[ternary.truthy];
      const falsyClass = layoutMap[ternary.falsy];
      const ngClass = `{ '${truthyClass}':'${ternary.condition.trim()}',  '${falsyClass}'}: '!${ternary.condition.trim()}'`;
      appendNgClass(element, truthyClass, `${ternary.condition.trim()}`);
      appendNgClass(element, falsyClass, `!(${ternary.condition.trim()})`);
      //$(element).attr('ngClass', ngClass, '${ternary.condition.trim()}');
    } else {
      $(element).addClass(`flex ${layoutMap[layoutValues]}`);
    }
    $(element).removeAttr('fxLayout [fxLayout]');
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
    start: {mainAxis: 'justify-start', crossAxis: 'items-start'},
    end: {mainAxis: 'justify-end', crossAxis: 'items-end'},
    center: {mainAxis: 'justify-center', crossAxis: 'items-center'},
    'space-between': {mainAxis: 'justify-between', crossAxis: 'items-center'},
    'space-around': {mainAxis: 'justify-around', crossAxis: 'items-center'},
    'space-evenly': {mainAxis: 'justify-evenly', crossAxis: 'items-center'},
    stretch: {mainAxis: 'justify-start', crossAxis: 'items-stretch'},
    baseline: {mainAxis: 'justify-start', crossAxis: 'items-baseline'},
  };

  $('[fxLayoutAlign], [\\[fxLayoutAlign\\]]').each((index, element) => {
    const alignValue = $(element).attr('fxLayoutAlign') || $(element).attr('[fxLayoutAlign]');

    // Handle ternary operators
    if (alignValue && alignValue.includes('?')) {
      $(element).before(`\n<!-- TODO: Ternary operators need carefull migration, before conversion it was: ${alignValue} -->\n`);
      const ternary = extractTernaryValues(alignValue);

      convertFxLayoutAlignToTailwind(element, ternary.truthy, `${ternary.condition.trim()}`);
      convertFxLayoutAlignToTailwind(element, ternary.falsy, `!${ternary.condition.trim()}`);
      // $(element).attr('ngClass', ngClass);
    } else {
      // Regular case
      [mainAxis, crossAxis] = alignValue.split("'").join("").split(" ");
      const mainAxisClass = alignMap[mainAxis]?.mainAxis || '';
      const crossAxisClass = alignMap[crossAxis]?.crossAxis || '';
      $(element).addClass(`${mainAxisClass} ${crossAxisClass} flex`);
      //convertFxLayoutAlignToTailwind(element, alignValue, true);
    }

    $(element).removeAttr('fxLayoutAlign [fxLayoutAlign]');
  });
}

/**
 * Converts space seperated fxLayoutAlign classes to Tailwind alignment classes
 * @param element
 */
function convertFxLayoutAlignToTailwind(element, value, condition) {
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

  let mainAxisClass;
  let crossAxisClass;

  if(value.includes(' ')){
    // this is required because in case "'space-around stretch'" we need to split by space and remove "'".
     [mainAxis, crossAxis] = value.split("'").join("").split(" ");
     mainAxisClass = alignMap[mainAxis].mainAxis || '';
     crossAxisClass = alignMap[crossAxis].crossAxis || '';
  }else{
     mainAxisClass = alignMap[value].mainAxis || '';
     crossAxisClass = alignMap[value].crossAxis || '';
  }


  appendNgClass(element, `${mainAxisClass} ${crossAxisClass} flex`, condition);

}

// Function to migrate fxLayoutGap attribute to Tailwind classes
function migrateFxLayoutGapToTailwind(element) {
  const $ = element;
  $('[fxLayoutGap], [\\[fxLayoutGap\\]]').each((index, element) => {
    const gapValue = $(element).attr('fxLayoutGap') || $(element).attr('[fxLayoutGap]');

    if (gapValue.includes('?')) {
      $(element).before(`\n<!-- TODO: Ternary operators need carefull migration, before conversion it was: ${gapValue} -->\n`);
      const ternary = extractTernaryValues(gapValue);
      const truthyClass = `gap-[${ternary.truthy}]`;
      const falsyClass = `gap-[${ternary.falsy}]`;

      appendNgClass(element, truthyClass, `${ternary.condition.trim()}`);
      appendNgClass(element, falsyClass, `!${ternary.condition.trim()}`);

      // const ngClass = `{ '${truthyClass}': '${ternary.condition.trim()}',  '${falsyClass}':'!${ternary.condition.trim()}'}`;
      // $(element).attr('ngClass', ngClass);
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
      $(element).before(`\n<!-- TODO: Ternary operators need carefull migration, before conversion it was: ${flexValue} -->\n`);

      const ternary = extractTernaryValues(flexValue);

      appendNgClass(element, `${convertFlex(ternary.truthy)}`, `${ternary.condition.trim()}`);
      appendNgClass(element, `${convertFlex(ternary.falsy)}`, `!(${ternary.condition.trim()})`);

      // const ngClass = `{${ternary.condition.trim()}: '${convertFlex(ternary.truthy)}', !${ternary.condition.trim()}: '${convertFlex(ternary.falsy)}'}`;
      // $(element).attr('ngClass', ngClass);
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
        return flexBasis === 'auto'? `flex-[${flexGrow}_${flexShrink}_${flexBasis}]` : `flex-[${flexGrow}_${flexShrink}_${flexBasis}%]`;
    }
    return flexGrow === 'auto' ? `flex-[1_1_${flexGrow}]` : `flex-[1_1_${flexGrow}%]`;
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
    let flexValue = $(element).attr('fxFill') || $(element).attr('[fxFill]') || $(element).attr('fxFlexFill') || $(element).attr('[fxFlexFill]');

    $(element).before(`\n<!-- TODO: Check the below conversion, use git compare to see the difference-->\n`);

    $(element).removeAttr('fxFlexFill [fxFlexFill] fxFill [fxFill]');
    $(element).addClass('w-full h-full min-w-full min-h-full box-border');
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
  const ast = parse(expression, {ecmaVersion: 'latest', sourceType: 'module'});

  /**
   * Recursively traverses the AST node to extract ternary expression parts.
   *
   * @param {Object} node - The AST node to be traversed.
   * @returns {Object|null} An object containing the ternary condition, truthy, and falsy values.
   */
  function extractFromNode(node) {
    // Check if the node is a ternary (ConditionalExpression) type.
    if (node.type === 'ConditionalExpression') {
      // Extract the condition, truthy value, and falsy value by recursively examining the AST nodes.
      const condition = extractTest(node.test);
      const truthyValue = extractValue(node.consequent);
      const falsyValue = extractValue(node.alternate);

      return {
        condition: condition.trim()?.split("'").join("'"), // Trim whitespace from condition for cleaner output
        truthy: truthyValue.trim(),  // Trim whitespace from truthy value
        falsy: falsyValue.trim()     // Trim whitespace from falsy value
      };
    }
    return null; // Return null if it's not a ConditionalExpression
  }

  /**
   * Extracts and formats the `test` part of a ternary expression, which is the condition.
   * It handles different types of conditions such as BinaryExpressions and optional chaining.
   *
   * @param {Object} testNode - The AST node representing the condition of the ternary expression.
   * @returns {string} The formatted condition string.
   */
  function extractTest(testNode) {
    // Handle BinaryExpression (e.g., a === b)
    if (testNode.type === 'BinaryExpression') {
      const left = extractValue(testNode.left);    // Left side of the binary expression
      const operator = testNode.operator;          // Operator (e.g., ===)
      const right = extractValue(testNode.right);  // Right side of the binary expression
      return `${left} ${operator} ${right}`;       // Return the combined condition as a string
    }

    // Handle ChainExpression for optional chaining (e.g., obj?.prop)
    else if (testNode.type === 'ChainExpression') {
      return extractValue(testNode.expression);    // Extract the value within the chain expression
    }

    // Handle MemberExpression for direct property access (e.g., obj.prop or obj?.prop)
    else if (testNode.type === 'MemberExpression') {
      const object = extractValue(testNode.object);        // Extract the object being accessed
      const property = testNode.property.name || extractValue(testNode.property); // Property name
      return `${object}${testNode.optional ? '?.' : '.'}${property}`; // Handle optional chaining
    }

    // Default case: extract the test condition as a substring from the original expression
    return extractValue(testNode);
  }

  /**
   * Extracts and formats the value from various AST node types (Identifier, Literal, MemberExpression, etc.).
   *
   * @param {Object} valueNode - The AST node representing a value in the ternary expression.
   * @returns {string} The extracted value as a string.
   */
  function extractValue(valueNode) {
    // Handle Identifier (e.g., variable names)
    if (valueNode.type === 'Identifier') {
      return valueNode.name;
    }

    // Handle Literal (e.g., numbers, strings)
    else if (valueNode.type === 'Literal') {
      return valueNode.raw; // Return the raw value (e.g., '10' or "'text'")
    }

    // Handle MemberExpression for property access (e.g., obj.prop or obj?.prop)
    else if (valueNode.type === 'MemberExpression') {
      const object = extractValue(valueNode.object);        // Object being accessed
      const property = valueNode.property.name || extractValue(valueNode.property); // Property name
      return `${object}${valueNode.optional ? '?.' : '.'}${property}`; // Handle optional chaining
    }

    // Fallback: Extract the value as a substring from the original expression if none of the above apply
    return expression.substring(valueNode.range[0], valueNode.range[1]);
  }

  // Start by extracting from the first expression in the AST
  const result = extractFromNode(ast.body[0].expression);

  // If the result is null, it means the provided expression is not a valid ternary expression
  if (!result) {
    throw new Error('Invalid ternary expression format');
  }

  // Return the final result containing the condition, truthy, and falsy values
  return result;
}


function appendNgClass(element, className, condition) {
  // Get the existing ngClass value as a string (assume it is a valid Angular expression)
  let existingNgClass = $(element).attr('[ngClass]') || '{}';

  // Check if it's an empty object, then format it properly
  if (existingNgClass === '{}') {
    existingNgClass = `{}`;
  }

  // Remove any outer curly braces for easier string manipulation
  existingNgClass = existingNgClass.replace(/^\{|\}$/g, '').trim();

  // Create a new class condition entry as a string
  const newClassEntry = `'${className}': ${condition}`;

  // If existing ngClass is empty, just add the new class entry
  if (existingNgClass === '') {
    existingNgClass = `{${newClassEntry}}`;
  } else {
    // Otherwise, append the new class entry to the existing ngClass
    existingNgClass = `{${existingNgClass}, ${newClassEntry}}`;
  }

  // Set the updated [ngClass] back to the element
  $(element).attr('[ngClass]', existingNgClass);
}


