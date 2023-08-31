Introduction

As Angular flex layout is deprecated, MIRAI needs to look for alternatives.




Alternatives Considered:
Tailwind css
Native css
Maintain FlexLayout lib.   




Alternative	Pros	cons
Native CSS	
Core Standard
Lesset Learning Curve
Lot of documentation and online resource
	
Need to write our own classes and mixins to cater dynamic flex properties like gap-1,gap-32,flex-1,flex-32
use polyfills for backward compatability

Tailwind CSS	
Works using Utility classes
Easy to learn
Can be Extended to other features in future
Smaller packages compared to flex layout
	
Intial setup is bit tricky, because documentation is out of date. 
Except tailwind being an extra library, it doesn't have more disadvantages

Maintaining FlexLayout Library	
Project teams and libraries doesn't need to plan for migration. 
	
maintainance will be a pain point for each angular upgrade




Decision :

Tailwind css, considering it is most popular css utilities library with huge community.

We decided to go with tailwind considering we also going to use for grid styles and components styles of tailwind in future.




Flexlayout to Tailwind Map
Angular Flexlayout	Tailwind	Native css
fxLayout="row"	class="flex flex-row"                  	

 {

display: flex;                                      

 flex-direction: row;

}


fxLayout="col"	class="flex flex-col"	

{

display: flex;                                      

 flex-direction: row;

}





fxLayout="row wrap"	class="flex flex-row flex-wrap"	

{

display: flex; 

//This is a shorthand for the flex-direction and flex-wrap                                    

 flex-flow: row wrap;

}


fxLayoutAlign="center center"	class="justify-center items-center"	

{

justify-content : center;

align-items: center;

align-content: center

}




fxFlex

fxFlex="auto"

fxFlex="10%"

fxFlex="100%"

fxFlex="none"

fxFlex="grow"

fxFlex="1 1 20rem"

	

class="flex-[1_1_0%] box-border"

class="flex-[1_1_auto] box-border"

class="flex-[1_1_10%] box-border"

class="flex-[1_1_100%] box-border max-w-[100%]"

class="flex-[0_0_auto] box-border"

class="flex-[1_1_100%] box-border"

class="flex-[1_1_20rem]"

	




{

flex:  <flex-grow> <flex-shrink> <flex-basis>

}


fxFlex.md="1 1 50rem"	class="md:flex-[1_1_50rem]"	

corresponding media queries



fxFlexAlign="start"
fxFlexAlign="center"
	

class="self-start"

class="self-center"

	





fxFill	class="min-w-[100%] w-[100%] min-h-[100%] h-[100%] m-0 "	

{

margin: 0;

height: 100%;

width:100%;

min-heght:100%;

min-width:100%

}


