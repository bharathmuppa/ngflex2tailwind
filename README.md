## Introduction

As Angular flex layout is deprecated, This tool helps in migrating from flex layout to Tailwind. 


# Usage

- `npx @ngnomads/ngflex2tailwind` By Default it Starts executing from Current Directory and Sub Directoroes
- `npx @ngnomads/ngflex2tailwind -r false` it Starts executing in Current Directory as you Switched off the Recursiveness
- `npx @ngnomads/ngflex2tailwind -r false -p ./test` you can also specify the folder to migrate

# Flexlayout to Tailwind Map

Technically we convert following directives into tailwind utility classes.

|Angular Flexlayout| Tailwind|	Native css|
|----|----|-----|
|fxLayout="row"|	class="flex flex-row"   |   { display: flex; </br> flex-direction: row;}|
|fxLayout="col"|	class="flex flex-col" |	{ display: flex; </br> flex-direction: row;}|
|fxLayout="row wrap"|	class="flex flex-row flex-wrap" | 	{ <br> display: flex; <br>//This is a shorthand for the flex-direction and flex-wrap<br> flex-flow:row wrap;}|
|fxLayoutAlign="center center"|	class="justify-center items-center"	| { <br>justify-content : center; <br>align-items: center; <br>align-content: center; }|
|fxFlex| class="flex-[1_1_0%] box-border"||
|fxFlex="auto" |class="flex-[1_1_auto] box-border"||
|fxFlex="10%"| class="flex-[1_1_10%] box-border" ||
|fxFlex="100%" |class="flex-[1_1_100%] box-border"||
|fxFlex="none"| class="flex-[1_1_100%] box-border max-w-[100%]" ||
|fxFlex="grow"| class="flex-[0_0_auto] box-border"| |
|fxFlex="1 1 20rem" |class="flex-[1_1_20rem]"||
|fxFlex.md="1 1 50rem"|	class="md:flex-[1_1_50rem]"	||
|fxFlexAlign="start"|class="self-start"||
|fxFlexAlign="center"|class="self-center"||
|fxFill	|class="min-w-[100%] w-[100%] min-h-[100%] h-[100%] m-0 "	| {<br> margin: 0;<br>height: 100%;<br>width:100%;<br>min-heght:100%;<br>min-width:100%}


> Note: Still this is in beta version, So please expect to have some bugs.
> Note: This tool doesn't support the flex responsive api yet.