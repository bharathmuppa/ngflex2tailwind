# ADR Document

## Introduction

As Angular flex layout is deprecated, We need to look for alternatives.

## Alternatives Considered:
- Tailwind css
- Native css
- Maintain FlexLayout lib.   

|Alternatives|Pros|Cons|
|------------|----|----|
|Native CSS|<ul><li>Core Standard </li><li>Less Learning Curve </li><li>Lot of documentation and online resource</li></ul>|<ul> <li>Need to write our own classes and mixins to cater dynamic flex properties like gap-1,gap-32,flex-1,flex-32</li><li>use polyfills for backward compatability</li><li>Writing classes for flex, grid and some cards will be an overkill.</li> <li>Can't keep up with latest css standards.</li></ul>|
|Tailwind CSS|<ul><li>Works using Utility classes</li><li>Easy to learn</li><li>Can be Extended to other features in future</li><li>Smaller packages compared to flex layout</li><ul>|<ul><li>Intial setup is bit tricky, because documentation is out of date.</li><li>Except tailwind being an extra library, it doesn't have more disadvantages</li></ul>|
|Maintaining FlexLayout Library|Project teams and libraries doesn't need to plan for migration.|maintainance will be a pain point for each angular upgrade.|