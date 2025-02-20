#!/usr/bin/env node

// Import required modules
const program = require('commander');
const fs = require('fs').promises;
const { glob } = require("glob");
const cheerio = require('cheerio');
const { parse } = require('@typescript-eslint/parser'); // Advanced syntax parsing

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
inputPath = options.path ? getFinalPath(options.path) : '.';
if (options.recursive === 'true') {
  inputPath = inputPath + '/**/*.html';
} else {
  inputPath = inputPath + '/*.html';
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
      await fs.writeFile(outputPath, $.html({ xmlMode: true }), { encoding: 'utf-8' });
    }
    console.log("Processing completed");
  } catch (error) {
    console.error("Error processing templates:", error);
  }
}
loopOverTemplates();


// ---------- Conversion Functions ----------

// Converts fxLayout attribute to Tailwind classes (produces a ternary [ngClass])
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
    'column-reverse': 'flex-col-reverse',
  };
  $(`[fxLayout], [\\[fxLayout\\]]`).each((index, elem) => {
    const layoutValues = $(elem).attr('fxLayout') || $(elem).attr('[fxLayout]');
    if (layoutValues && layoutValues.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary migration: ${layoutValues} -->\n`);
      const ternary = extractTernaryValues(layoutValues);
      const condition = ternary.condition.trim();
      const truthyValue = stringConversion(ternary.truthy).trim();
      const falsyValue = stringConversion(ternary.falsy).trim();
      const truthyClass = (`flex ${layoutMap[truthyValue] || ''}`).trim();
      const falsyClass = (`flex ${layoutMap[falsyValue] || ''}`).trim();
      // Set a single ternary expression in [ngClass]
      $(elem).attr('[ngClass]', `[${condition} ? '${truthyClass}' : '${falsyClass}']`);
    } else {
      $(elem).addClass(`flex ${layoutMap[layoutValues]}`);
    }
    $(elem).removeAttr('fxLayout [fxLayout]');
  });
}

// Marks responsive fxLayout attributes for manual review.
function handleResponsiveFxLayout(element) {
  const $ = element;
  $(`[fxLayout\\.sm], [fxLayout\\.xs], [fxLayout\\.md], [fxLayout\\.lg], [fxLayout\\.xl]`).each((index, elem) => {
    $(elem).before(`\n<!-- TODO: Responsive API migration not handled -->\n`);
  });
}

// Merges fxLayoutAlign conversion into any existing [ngClass] from fxLayout.
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
  $('[fxLayoutAlign], [\\[fxLayoutAlign\\]]').each((index, elem) => {
    const alignValue = $(elem).attr('fxLayoutAlign') || $(elem).attr('[fxLayoutAlign]');
    if (alignValue && alignValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary migration: ${alignValue} -->\n`);
      const ternary = extractTernaryValues(alignValue);
      const condition = ternary.condition.trim();
      const truthyStr = stringConversion(ternary.truthy).trim();
      const falsyStr = stringConversion(ternary.falsy).trim();
      // Split into tokens (e.g. "space-between center")
      const truthyTokens = truthyStr.split(/\s+/).filter(Boolean);
      const falsyTokens = falsyStr.split(/\s+/).filter(Boolean);
      let alignTruthy = '';
      if (truthyTokens.length) {
        alignTruthy = ((alignMap[truthyTokens[0]] ? alignMap[truthyTokens[0]].mainAxis : '') +
          (truthyTokens[1] ? ' ' + (alignMap[truthyTokens[1]] ? alignMap[truthyTokens[1]].crossAxis : '') : '')).trim();
      }
      let alignFalsy = '';
      if (falsyTokens.length) {
        alignFalsy = ((alignMap[falsyTokens[0]] ? alignMap[falsyTokens[0]].mainAxis : '') +
          (falsyTokens[1] ? ' ' + (alignMap[falsyTokens[1]] ? alignMap[falsyTokens[1]].crossAxis : '') : '')).trim();
      }
      // Merge with existing [ngClass] if present
      const existingNgClass = $(elem).attr('[ngClass]');
      if (existingNgClass) {
        let expr = existingNgClass.trim();
        if (expr.startsWith('[') && expr.endsWith(']')) {
          expr = expr.slice(1, -1);
        }
        const ternaryRegex = /^(.*?)\?(.*?)\:(.*)$/;
        const matches = expr.match(ternaryRegex);
        if (matches) {
          let existingCondition = matches[1].trim();
          let existingTruthy = matches[2].trim().replace(/^['"]|['"]$/g, '');
          let existingFalsy = matches[3].trim().replace(/^['"]|['"]$/g, '');
          // If the condition from fxLayout and fxLayoutAlign match, merge classes
          if (existingCondition === condition) {
            let newTruthy = (existingTruthy + (alignTruthy ? ' ' + alignTruthy : '')).trim();
            let newFalsy = (existingFalsy + (alignFalsy ? ' ' + alignFalsy : '')).trim();
            $(elem).attr('[ngClass]', `[${condition} ? '${newTruthy}' : '${newFalsy}']`);
          } else {
            // If conditions differ, do not merge (fallback: leave existing)
            $(elem).attr('[ngClass]', `[${existingCondition} ? '${existingTruthy}' : '${existingFalsy}']`);
          }
        } else {
          $(elem).attr('[ngClass]', `[${condition} ? '${alignTruthy ? ('flex ' + alignTruthy) : 'flex'}' : '${alignFalsy ? ('flex ' + alignFalsy) : 'flex'}']`);
        }
      } else {
        // No existing [ngClass] – set one with a default 'flex' prefix.
        const prefixTruthy = alignTruthy ? 'flex ' : 'flex';
        const prefixFalsy = alignFalsy ? 'flex ' : 'flex';
        $(elem).attr('[ngClass]', `[${condition} ? '${prefixTruthy + alignTruthy}' : '${prefixFalsy + alignFalsy}']`);
      }
    } else {
      // Non-ternary: simply add the mapped classes.
      const tokens = alignValue.replace(/'/g, "").split(/\s+/).filter(Boolean);
      const mainAxisClass = tokens[0] && alignMap[tokens[0]] ? alignMap[tokens[0]].mainAxis : '';
      const crossAxisClass = tokens[1] && alignMap[tokens[1]] ? alignMap[tokens[1]].crossAxis : '';
      $(elem).addClass(`flex ${mainAxisClass} ${crossAxisClass}`.trim());
    }
    $(elem).removeAttr('fxLayoutAlign [fxLayoutAlign]');
  });
}

// Converts fxLayoutGap attribute to Tailwind gap classes (ignores extra tokens like "grid")
function migrateFxLayoutGapToTailwind(element) {
  const $ = element;
  $('[fxLayoutGap], [\\[fxLayoutGap\\]]').each((index, elem) => {
    const gapValue = $(elem).attr('fxLayoutGap') || $(elem).attr('[fxLayoutGap]');
    if (gapValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary migration: ${gapValue} -->\n`);
      const ternary = extractTernaryValues(gapValue);
      const condition = ternary.condition.trim();
      const truthySize = ternary.truthy.split(' ')[0];
      const falsySize = ternary.falsy.split(' ')[0];
      const truthyClass = `gap-[${truthySize}]`;
      const falsyClass = `gap-[${falsySize}]`;
      $(elem).attr('[ngClass]', `[${condition} ? '${truthyClass}' : '${falsyClass}']`);
    } else {
      const gapSize = gapValue.split(' ')[0];
      $(elem).addClass(`gap-[${gapSize}]`);
    }
    $(elem).removeAttr('fxLayoutGap [fxLayoutGap]');
  });
}

// Converts fxFlex attribute to Tailwind flex classes.
function migrateFxFlexToTailwind(element) {
  const $ = element;
  $('[fxFlex], [\\[fxFlex\\]]').each((index, elem) => {
    let flexValue = $(elem).attr('fxFlex') || $(elem).attr('[fxFlex]');
    if (!flexValue) {
      $(elem).addClass('flex-[1_1_0%] box-border');
    } else if (flexValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ternary migration: ${flexValue} -->\n`);
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

// Converts fxFlexFill attribute to Tailwind classes.
function migrateFlexFillToTailwind(element) {
  const $ = element;
  $('[fxFill], [fxFlexFill], [\\[fxFlexFill\\]], [\\[fxFill\\]]').each((index, elem) => {
    let flexValue = $(elem).attr('fxFill') || $(elem).attr('[fxFill]') || $(elem).attr('fxFlexFill') || $(elem).attr('[fxFlexFill]');
    $(elem).before(`\n<!-- TODO: Check conversion below, compare with git diff -->\n`);
    $(elem).removeAttr('fxFlexFill [fxFlexFill] fxFill [fxFill]');
    $(elem).addClass('w-full h-full min-w-full min-h-full box-border');
  });
}

// ---------- Utility Functions ----------

// Uses the TypeScript ESLint parser to extract ternary parts.
function extractTernaryValues(expression) {
  const ast = parse(expression, { ecmaVersion: 'latest', sourceType: 'module' });
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

// Strips single quotes from the beginning and end of a string.
function stringConversion(input) {
  return input.replace(/^'|'$/g, '');
}
