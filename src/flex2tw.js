#!/usr/bin/env node
/**
 * Migration tool for Angular Flex layout to Tailwind CSS.
 *
 * This script scans the provided folder for HTML files,
 * converts Angular Flex Layout directives to Tailwind classes,
 * and then writes back the modified HTML.
 *
 * Usage:
 *   node ./src/flex2tw.js -p <path-to-html-files> [-r true|false]
 *
 * Example:
 *   npx @ngnomads/tailwind2css projects
 */

const program = require('commander');
const fs = require('fs').promises;
const { glob } = require("glob");
const cheerio = require('cheerio');
const { parse } = require('@typescript-eslint/parser'); // Advanced syntax parsing

// Define the command-line interface using Commander.
program
  .version('1.0.0')
  .description('Migration tool for Angular Flex layout to Tailwind CSS')
  .option('-p, --path <path>', 'Path to folder containing HTML files')
  .option('-r, --recursive [value]', 'Recursively process sub-folders', 'true')
  .parse(process.argv);

// Initialize variables.
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

// Resolve the absolute path.
function getFinalPath(inputPath) {
  const path = require('path');
  return path.resolve(inputPath);
}

// Helper: Remove wrapping parentheses from a condition.
function normalizeCondition(cond) {
  cond = cond.trim();
  if (cond.startsWith('(') && cond.endsWith(')')) {
    cond = cond.slice(1, -1).trim();
  }
  return cond;
}

// Helper: Parse a ternary string by splitting on " ? " and " : " (with surrounding spaces).
function parseTernary(expr) {
  let parts = expr.split(/\s\?\s/);
  if (parts.length < 2) return null;
  let conditionPart = parts[0].trim();
  let rest = parts.slice(1).join(" ? ");
  let subparts = rest.split(/\s:\s/);
  if (subparts.length < 2) return null;
  let truthyPart = subparts[0].trim().replace(/^['"]|['"]$/g, '');
  let falsyPart = subparts.slice(1).join(" : ").trim().replace(/^['"]|['"]$/g, '');
  return { condition: conditionPart, truthy: truthyPart, falsy: falsyPart };
}

// Helper: Fix self-closing tags in the final HTML output.
// This function finds known self-closing tags (img, br, hr, input, etc.) rendered with an opening and closing tag
// and converts them to the self-closing form.
function fixSelfClosingTags(html) {
  // List of known self-closing tags.
  const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  selfClosingTags.forEach(tag => {
    // Regex to match an opening tag, optional attributes, optional whitespace,
    // then a closing tag for the same element.
    const regex = new RegExp(`<(${tag})(\\s[^>]*?)?>\\s*<\\/\\1>`, 'gi');
    html = html.replace(regex, `<$1$2 />`);
  });
  return html;
}

// Main function: Process each HTML template and apply conversions.
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
        selfClosingTags: false, // We'll fix self closing tags later.
      });
      // Apply migration functions.
      handleFxLayout($);
      handleResponsiveFxLayout($);
      migrateFxLayoutAlignToTailwind($);
      migrateFxLayoutGapToTailwind($);
      migrateFxFlexToTailwind($);
      migrateFlexFillToTailwind($);
      // Generate output HTML in xmlMode then fix self closing tags.
      let outputHtml = $.html({ xmlMode: true });
      outputHtml = fixSelfClosingTags(outputHtml);
      // Save the modified HTML.
      const outputPath = finalPath || templatePath;
      await fs.writeFile(outputPath, outputHtml, { encoding: 'utf-8' });
    }
    console.log("Processing completed");
  } catch (error) {
    console.error("Error processing templates:", error);
  }
}

loopOverTemplates().then(() => {
  console.log("Migration completed successfully.");
});

// ---------- Conversion Functions ----------

// fxLayout conversion: Maps 'row'/'column' etc. to Tailwind layout classes.
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
      $(elem).before(`\n<!-- TODO: Ngnomads:  Ternary migration: ${layoutValues} -->\n`);
      const ternary = extractTernaryValues(layoutValues);
      let condition = normalizeCondition(ternary.condition);
      const truthyValue = stringConversion(ternary.truthy).trim();
      const falsyValue = stringConversion(ternary.falsy).trim();
      const truthyClass = (`flex ${layoutMap[truthyValue] || ''}`).trim();
      const falsyClass = (`flex ${layoutMap[falsyValue] || ''}`).trim();
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
    $(elem).before(`\n<!-- TODO: Ngnomads:  Responsive API migration not handled -->\n`);
  });
}

// fxLayoutAlign conversion: Maps alignment tokens to Tailwind alignment classes and merges with existing [ngClass] if present.
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
      $(elem).before(`\n<!-- TODO: Ngnomads:  Ternary migration: ${alignValue} -->\n`);
      const ternary = extractTernaryValues(alignValue);
      let condition = normalizeCondition(ternary.condition);
      const truthyStr = stringConversion(ternary.truthy).trim();
      const falsyStr = stringConversion(ternary.falsy).trim();
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
      // Merge with existing [ngClass] if present.
      const existingNgClass = $(elem).attr('[ngClass]');
      if (existingNgClass) {
        let expr = existingNgClass.trim();
        if (expr.startsWith('[') && expr.endsWith(']')) {
          expr = expr.slice(1, -1);
        }
        const parsed = parseTernary(expr);
        if (parsed && parsed.condition === condition) {
          let newTruthy = (parsed.truthy + (alignTruthy ? ' ' + alignTruthy : '')).trim();
          let newFalsy = (parsed.falsy + (alignFalsy ? ' ' + alignFalsy : '')).trim();
          $(elem).attr('[ngClass]', `[${condition} ? '${newTruthy}' : '${newFalsy}']`);
        } else {
          $(elem).attr('[ngClass]', `[${expr}]`);
        }
      } else {
        const prefixTruthy = alignTruthy ? 'flex ' : 'flex';
        const prefixFalsy = alignFalsy ? 'flex ' : 'flex';
        $(elem).attr('[ngClass]', `[${condition} ? '${prefixTruthy + alignTruthy}' : '${prefixFalsy + alignFalsy}']`);
      }
    } else {
      const tokens = alignValue.replace(/'/g, "").split(/\s+/).filter(Boolean);
      const mainAxisClass = tokens[0] && alignMap[tokens[0]] ? alignMap[tokens[0]].mainAxis : '';
      const crossAxisClass = tokens[1] && alignMap[tokens[1]] ? alignMap[tokens[1]].crossAxis : '';
      $(elem).addClass(`flex ${mainAxisClass} ${crossAxisClass}`.trim());
    }
    $(elem).removeAttr('fxLayoutAlign [fxLayoutAlign]');
  });
}

// fxLayoutGap conversion: Uses only the first token.
function migrateFxLayoutGapToTailwind(element) {
  const $ = element;
  $('[fxLayoutGap], [\\[fxLayoutGap\\]]').each((index, elem) => {
    const gapValue = $(elem).attr('fxLayoutGap') || $(elem).attr('[fxLayoutGap]');
    if (gapValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ngnomads:  Ternary migration: ${gapValue} -->\n`);
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

// fxFlex conversion: Merges with existing [ngClass] if condition matches.
function migrateFxFlexToTailwind(element) {
  const $ = element;
  $('[fxFlex], [\\[fxFlex\\]]').each((index, elem) => {
    let flexValue = $(elem).attr('fxFlex') || $(elem).attr('[fxFlex]');
    if (!flexValue) {
      $(elem).addClass('flex-[1_1_auto] box-border');
    } else if (flexValue.includes('?')) {
      $(elem).before(`\n<!-- TODO: Ngnomads:  Ternary migration: ${flexValue} -->\n`);
      const ternary = extractTernaryValues(flexValue);
      let condition = normalizeCondition(ternary.condition);
      let newFxTruthy = `${convertFlex(ternary.truthy)} box-border`;
      let newFxFalsy = `${convertFlex(ternary.falsy)} box-border`;
      if (ternary.truthy.includes('100%')) {
        newFxTruthy += ' max-w-[100%]';
      }
      if (ternary.falsy.includes('100%')) {
        newFxFalsy += ' max-w-[100%]';
      }
      const existingNgClass = $(elem).attr('[ngClass]');
      if (existingNgClass) {
        let expr = existingNgClass.trim();
        if (expr.startsWith('[') && expr.endsWith(']')) {
          expr = expr.slice(1, -1);
        }
        const parsed = parseTernary(expr);
        if (parsed && parsed.condition === condition) {
          let mergedTruthy = (parsed.truthy + ' ' + newFxTruthy).trim();
          let mergedFalsy = (parsed.falsy + ' ' + newFxFalsy).trim();
          $(elem).attr('[ngClass]', `[${condition} ? '${mergedTruthy}' : '${mergedFalsy}']`);
        } else {
          $(elem).attr('[ngClass]', `[${condition} ? '${newFxTruthy}' : '${newFxFalsy}']`);
        }
      } else {
        $(elem).attr('[ngClass]', `[${condition} ? '${newFxTruthy}' : '${newFxFalsy}']`);
      }
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

// convertFlex: Updated to properly handle three-token values.
function convertFlex(flexValue) {
  flexValue = stringConversion(flexValue).trim();
  const tokens = flexValue.split(/\s+/).filter(Boolean);
  if (tokens.length === 3) {
    let [grow, shrink, basis] = tokens;
    if (!basis.match(/(%|px|rem)$/) && basis !== 'auto') {
      basis = basis + '%';
    }
    return `flex-[${grow}_${shrink}_${basis}]`;
  }
  if (flexValue === 'auto') {
    return 'flex-[1_1_auto]';
  } else if(flexValue === ''){
    return '';
  } else if (flexValue === "none") {
    return 'flex-[0_0_auto]';
  } else if (flexValue === "grow" || flexValue === "100") {
    return 'flex-[1_1_100%]';
  } else if (flexValue.includes('%') || flexValue.includes('px') || flexValue.includes('rem')) {
    return `flex-[1_1_${flexValue}]`;
  }
  return `flex-[1_1_${flexValue}%]`;
}

// fxFlexFill conversion.
function migrateFlexFillToTailwind(element) {
  const $ = element;
  $('[fxFill], [fxFlexFill], [\\[fxFlexFill\\]], [\\[fxFill\\]]').each((index, elem) => {
    let flexValue = $(elem).attr('fxFill') || $(elem).attr('[fxFill]') ||
      $(elem).attr('fxFlexFill') || $(elem).attr('[fxFlexFill]');
    $(elem).before(`\n<!-- TODO: Ngnomads:  Check conversion below, compare with git diff -->\n`);
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
        condition: condition.trim(),
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
    } else if (valueNode.type === 'CallExpression') {
      const callee = extractValue(valueNode.callee);
      const args = valueNode.arguments.map(arg => extractValue(arg)).join(', ');
      return `${callee}(${args})`;
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
