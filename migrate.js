#!/usr/bin/env node
const program = require('commander');
const fs = require('fs').promises;
const { glob } = require("glob")
const cheerio = require('cheerio');
const acorn = require('acorn');

program
  .version('1.0.0')
  .description('Migrtion tool for Angular Flex layout to Tailwind')
  .option('-p, --path <path>', 'Path to folder')
  .option('-r, --recursive [value]', 'Loop over sub folders', true)
  .parse(process.argv);

let inputPath;
let finalPath;

let options = program.opts();

if (options.path && options.recursive) {
  inputPath = getFinalPath(options.path);
  inputPath += "/**/*.html";
} else if (!options.path && options.recursive) {
  inputPath = './**/*.html';
} else {
  inputPath = './*.html';
}


function getFinalPath(inputPath) {
  // Use path.resolve to get the final path
  return path.resolve(inputPath);
}

// Loop over Templates within files
async function loopOverTemplates() {
  // options is optional

  const templates = await glob(inputPath, { ignore: 'node_modules/**' });

  for (const templatePath of templates) {
    console.info(templatePath);
    
    const contents = await fs.readFile(templatePath, 'utf8');
    
    const $ = cheerio.load(contents, {
      xmlMode: true, // Preserve case sensitivity
      decodeEntities: false,
      normalizeWhitespace: false,
      selfClosingTags: false,
    });

    // Call the function to handle fxLayout attribute for row layout
    handleFxLayout($);

    // call this function to handle fxlayout with responsive attibutes
    handleResponsiveFxLayout($);

    // Call the function to handle all scenarios with flex layout align
    migrateFxLayoutAlignToTailwind($)

    // Call the function to handle fxLayoutGap attribute
    migrateFxLayoutGapToTailwind($);

    // Call this function to handle fxFlex variants
    migrateFxFlexToTailwind($);

    migrateFlexFillToTailwind($);

    //  convertAllSelfClosingTagsToOpenAndCloseTags($);
    if (finalPath) {
      await fs.writeFile(finalPath, $.html({ xmlMode: true }), {
        encoding: 'utf-8'
      });
      return;
    }
    await fs.writeFile(templatePath, $.html({ xmlMode: true }), {
      encoding: 'utf-8'
    });

  }
}


loopOverTemplates().then(r => console.log("Processing completed"), err => console.log(err));

// Handles fxLayout attribute,  this is not for the responsive attributes
function handleFxLayout(element) {
  const $ = element;
  const map = {
    'row': 'flex-row',
    'column': 'flex-col'
  }
  $(`[fxLayout], [\\[fxLayout\\]]`).each((index, element) => {
    const layoutValues = $(element).attr('fxLayout') || $(element).attr('[fxLayout]');
    // Remove the fxLayout attribute
    $(element).removeAttr('fxLayout [fxLayout]');
    // Add the class with flex and layout class
    $(element).addClass(`flex ${map[layoutValues]}`);
  });
}

// Handles fxLayout attribute which has responsive attributes
function handleResponsiveFxLayout(element) {
  const $ = element;
  
  $(`[fxLayout\\.sm], [fxLayout\\.xs], [fxLayout\\.md], [fxLayout\\.lg], [fxLayout\\.xl] `).each((index, element) => {
    $(element).before(`\n<!-- TODO: Responsive  API migration is not yet handled, so please take care of it manually -->\n`);
  });
}



// Function to handle fxLayoutAlign attribute
function migrateFxLayoutAlignToTailwind(element) {
  const $ = element;
  const flexLayoutAlignMap = {
    start: {
      mainAxis: 'justify-start',
      crossAxis: 'items-start',
    },
    end: {
      mainAxis: 'justify-end',
      crossAxis: 'items-end',
    },
    center: {
      mainAxis: 'justify-center',
      crossAxis: 'items-center',
    },
    'space-between': {
      mainAxis: 'justify-between',
      crossAxis: 'items-center',
    },
    'space-around': {
      mainAxis: 'justify-around',
      crossAxis: 'items-center',
    },
    'space-evenly': {
      mainAxis: 'justify-evenly',
      crossAxis: 'items-center',
    },
    stretch: {
      mainAxis: 'justify-start',
      crossAxis: 'items-stretch',
    },
    baseline: {
      mainAxis: 'justify-start',
      crossAxis: 'items-baseline',
    },
  };
  $('[fxLayoutAlign], [\\[fxLayoutAlign\\]]').each((index, element) => {
    const alignValue = $(element).attr('fxLayoutAlign') || $(element).attr('[fxLayoutAlign]');

    // in case of terniary opearators, we should do more processing
    if (alignValue && alignValue.includes('?')) {
      $(element).before(`\n<!-- TODO: Check this migration script as it is tricky to convert all conditional operations in templates -->\n`);

      // then find out terniary opeartor with optional chaining
      const terniaryOperation = extractTernaryValues(alignValue);

      const [mainAxisT, crossAxisT] = stringConversion(terniaryOperation.truthy).split(' ');
     
      const mainAxisClassT = flexLayoutAlignMap[mainAxisT] ? flexLayoutAlignMap[mainAxisT].mainAxis : '';
      const crossAxisClassT = flexLayoutAlignMap[crossAxisT] ? flexLayoutAlignMap[crossAxisT].crossAxis : '';

      const [mainAxisF, crossAxisF] = stringConversion(terniaryOperation.falsy).split(' ');
      const mainAxisClassF = flexLayoutAlignMap[mainAxisF] ? flexLayoutAlignMap[mainAxisF].mainAxis : '';
      const crossAxisClassF = flexLayoutAlignMap[crossAxisF] ? flexLayoutAlignMap[crossAxisF].crossAxis : '';

      let ngClass;

      if ($(element).attr('ngClass')?.length > 0) {
        $(element).before(`\n<!-- TODO: Add following ngClass manually \n{'${terniaryOperation.condition.trim()}': '${mainAxisClassT} ${crossAxisClassT}', '!${terniaryOperation.trim()}': '${mainAxisClassF} ${crossAxisClassF}' -->\n`);
      } else {
        ngClass = `{'${terniaryOperation.condition.trim()}': '${mainAxisClassT} ${crossAxisClassT}', '!${terniaryOperation.condition.trim()}': '${mainAxisClassF} ${crossAxisClassF}'`;
        $(element).attr('ngClass', ngClass);
      }


      // Remove the fxLayoutAlign attribute
      $(element).removeAttr('fxLayoutAlign [fxLayoutAlign]');

      return;
    }

    // Remove the fxLayoutAlign attribute
    $(element).removeAttr('fxLayoutAlign [fxLayoutAlign]');

    // Split the alignValue into main axis and cross axis values
    const [mainAxis, crossAxis] = alignValue.split(' ');


    const mainAxisClass = flexLayoutAlignMap[mainAxis] ? flexLayoutAlignMap[mainAxis].mainAxis : '';
    const crossAxisClass = flexLayoutAlignMap[crossAxis] ? flexLayoutAlignMap[crossAxis].crossAxis : '';

    // Add the classes for main axis and cross axis
    $(element).addClass(`${mainAxisClass} ${crossAxisClass}`);

    if (!$(element).hasClass('flex flex-row') || !$(element).hasClass('flex flex-col')) {
      $(element).addClass(`flex flex-row`);
    }
  });
}


// Function to handle fxLayoutGap attribute
function migrateFxLayoutGapToTailwind(element) {
  const $ = element;
  $('[fxLayoutGap], [\\[fxLayoutGap\\]]').each((index, element) => {
    const gapValue = $(element).attr('fxLayoutGap') || $(element).attr('[fxLayoutGap]');

    if ((gapValue.match(/\?/g) || []).length > 1) {
      $(element).before(`\n<!-- TODO: Please Migrate these fxLayoutGap with terniary operators Manually -->\n`);
      return;
    }

    // Remove the fxLayoutGap attribute
    $(element).removeAttr('fxLayoutGap [fxLayoutGap]');

    // Add the class with dynamic gap value
    $(element).addClass(`gap-[${gapValue}]`);
  });
}


// Function to handle fxFlex attribute
function migrateFxFlexToTailwind(element) {
  const $ = element;

  $('[fxFlex], [\\[fxFlex\\]]').each((index, element) => {

    let flexValue = $(element).attr('fxFlex') || $(element).attr('[fxFlex]');


    if (!flexValue) {
      $(element).addClass('flex-[1_1_0%] box-border');
      // Remove the fxFlex attribute
      $(element).removeAttr('fxFlex [fxFlex]');
      return;
    }



    // Check if the flexValue contains a ternary operator
    if (flexValue && flexValue.includes('?')) {

      // then find out terniary opeartor with optional chaining
      const terniaryOperation = extractTernaryValues(flexValue);

      const ngClass = `{${terniaryOperation.condition.trim()}: '${convertFlex(terniaryOperation.truthy)}', !${terniaryOperation.condition.trim()}: '${convertFlex(terniaryOperation.falsy)}'}`;
      $(element).attr('ngClass', ngClass);
      $(element).addClass('box-border');


      if (flexValue.includes('100%')) {
        $(element).addClass('max-w-[100%]');
      }
    } else {
      // Check for different variations of flexValue
      $(element).addClass(convertFlex(flexValue) + ' box-border');
      if (flexValue.includes('100%')) {
        $(element).addClass('max-w-[100%]');
      }
    }

    // Remove the fxFlex attribute
    $(element).removeAttr('fxFlex [fxFlex]');


  });
}

function convertFlex(flexValue) {
  // Check for different variations of flexValue
  flexValue = stringConversion(flexValue);
  if (flexValue === 'auto') {
    return 'flex-[1_1_auto]';
  } else if (flexValue.includes('%') || flexValue.includes('px') || flexValue.includes('rem')) {
    return 'flex-[1_1_' + flexValue + ']';
  } else if (flexValue === "none") {
    return 'flex-[0_0_auto]';
  } else if (flexValue === "grow" || flexValue=="100") {
    return 'flex-[1_1_100%]';
  } else if (flexValue && flexValue.length > 0) {
    const [flexGrow, flexShrink, flexBasis] = flexValue.split(' ');
    return 'flex-[' + flexGrow + '_' + flexShrink + '_' + flexBasis + ']';
  }
}

function stringConversion(input) {
  return input.replace(/^'|'$/g, '');
}


function migrateFlexFillToTailwind(element) {
  const $ = element;

  $('[fxFill], [fxFlexFill], [\\[fxFlexFill\\]], [\\[fxFill\\]]').each((index, element) => {
    $(element).removeAttr('fxFlexFill [fxFlexFill] fxFill [fxFill]');
    $(element).addClass('w-full h-full min-w-full min-h-full box-border');

  });

  return $.html();
}


function extractTernaryValues(expression) {
  const ast = acorn.parse(expression, { ecmaVersion: 'latest' });

  function traverse(node) {
    if (node.type === 'ConditionalExpression') {
      const condition = expression.substring(node.test.start, node.test.end);
      const truthyValue = expression.substring(node.consequent.start, node.consequent.end);
      const falsyValue = expression.substring(node.alternate.start, node.alternate.end);

      return {
        condition: condition.trim(),
        truthy: truthyValue.trim(),
        falsy: falsyValue.trim(),
      };
    }
    return null;
  }

  console.log();

  const result = traverse(ast.body[0].expression);

  if (!result) {
    console.log(expression);
    console.log(ast);
    throw new Error('Invalid ternary expression format');
  }

  return result;
}





