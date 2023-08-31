const fs = require('fs').promises;
const {glob} = require("glob")
const cheerio = require('cheerio');

// Loop over Templates within files
async function loopOverTemplates() {
// options is optional

  const templates = await glob("./projects/asml-angular/material/**/button-toggle.*.html", {ignore: 'node_modules/**'});

  for (const templatePath of templates) {
    console.info(templatePath)
    const contents = await fs.readFile(templatePath, 'utf8');
    const $ = cheerio.load(contents, {
      xmlMode: true, // Preserve case sensitivity
      decodeEntities: false,
      normalizeWhitespace: false,
      selfClosingTags: false,
    });

    // Call the function to handle fxLayout attribute for row layout
    handleFxLayout($, 'row', 'flex-row');

    // Call the function to handle fxLayout attribute for column layout
    handleFxLayout($, 'column', 'flex-col');

    // Call the function to handle all scenarios with flex layout align
    migrateFxLayoutAlignToTailwind($)

    // Call the function to handle fxLayoutGap attribute
    migrateFxLayoutGapToTailwind($);

    // Call this function to handle fxFlex variants
    migrateFxFlexToTailwind($);

    migrateFlexFillToTailwind($);

    convertAllSelfClosingTagsToOpenAndCloseTags($);

    await fs.writeFile(templatePath, $.html({ xmlMode: true }), {
      encoding: 'utf-8'
    });

  }
}


loopOverTemplates().then(r => console.log("Processing completed"), err => console.log(err));

// Function to handle fxLayout attribute
function handleFxLayout(element, layoutValue, className) {
  const $ = element;
  $(`[fxLayout="${layoutValue}"], [\\[fxLayout=\\"${layoutValue}\\"\\]]`).each((index, element) => {
    // Remove the fxLayout attribute
    $(element).removeAttr('fxLayout [fxLayout]');

    // Add the class with flex and layout class
    $(element).addClass(`flex ${className}`);
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

    if((alignValue.match(/\?/g)||[]).length>1 ){
      $(element).before(`\n<!-- TODO: Please Migrate these fxLayoutAlign with terniary operators Manually -->\n`);
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

    if((gapValue.match(/\?/g)||[]).length>1 ){
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

    // Remove the fxFlex attribute
    $(element).removeAttr('fxFlex [fxFlex]');


    if (!flexValue) {
      $(element).addClass('flex-auto');
      return;
    }

    if((flexValue.match(/\?/g)||[]).length>1 ){
      $(element).before(`\n<!-- TODO: Please Migrate these fxFlex with terniary operators Manually -->\n`);
      return;
    }
    // Check if the flexValue contains a ternary operator
    if (flexValue && flexValue.includes('?')) {

      const [condition, values] = flexValue.split('?');
      const [trueValue, falseValue] = values.split(':');



      const ngClass = `{'${condition.trim()}': 'flex-[${trueValue.trim().replace(/^'|'$/g, '').split(" ").join("_")}]', '!${condition.trim()}': 'flex-[${falseValue.trim().replace(/^'|'$/g, '').split(" ").join("_")}'}]`;
      $(element).attr('ngClass', ngClass);
    } else {

      // Check for different variations of flexValue
      if (flexValue === 'auto') {
        $(element).addClass('flex-auto');
      } else if (flexValue.includes('%') || flexValue.includes('px') || flexValue.includes('%rem')) {
        $(element).addClass(`flex-[${flexValue}]`);
      } else if (flexValue && flexValue.length > 0) {
        const [flexGrow, flexShrink, flexBasis] = flexValue.split(' ');
        $(element).addClass(`flex-grow-${flexGrow} flex-shrink-${flexShrink} flex-${flexBasis}`);
      }
    }
  });
}


function migrateFlexFillToTailwind(element) {
  const $ = element;

  $('[fxFlexFill], [\\[fxFlexFill\\]]').each((index, element) => {
    $(element).addClass('w-full h-full min-w-full min-h-full');
    $(element).removeAttr('fxFlexFill [fxFlexFill]');
  });

  return $.html();
}

/**
 *  This function is needed as a side effect of cheerio initial lode property , xmlMode = true
 * @param element
 */
function convertAllSelfClosingTagsToOpenAndCloseTags(element){
  const $= element;
  $('*').each((index, element) => {
    const tagName = element.tagName;

    // Check if the element is self-closed
    if (element.childNodes.length === 0) {
      // Replace the self-closed element with opening and closing tags
      $(element).replaceWith(`<${tagName}></${tagName}>`);
    }

  });
  console.log($.html());
}
