// Flowable-specific builtins to replace Camunda FEEL built-ins
// This replaces @camunda/feel-builtins to provide Flowable-compatible autocomplete

export const camundaBuiltins = [
  // Flowable Collection Functions
  {
    name: 'collection:anyOf',
    detail: 'collection:anyOf(collection, comparisons)',
    info: 'Returns true if any element in the collection matches any of the comparison values'
  },
  {
    name: 'collection:noneOf',
    detail: 'collection:noneOf(collection, comparisons)',
    info: 'Returns true if no element in the collection matches any of the comparison values'
  },
  {
    name: 'collection:notAllOf',
    detail: 'collection:notAllOf(collection, comparisons)',
    info: 'Returns true if not all elements in the collection match any of the comparison values'
  },
  {
    name: 'collection:allOf',
    detail: 'collection:allOf(collection, comparisons)',
    info: 'Returns true if all elements in the collection match any of the comparison values'
  },

  // Flowable/JUEL Comparison Operators
  {
    name: '==',
    detail: 'var == value',
    info: 'Equality comparison in JUEL expressions'
  },
  {
    name: '!=',
    detail: 'var != value',
    info: 'Inequality comparison in JUEL expressions'
  },
  {
    name: '<=',
    detail: 'var <= value',
    info: 'Less than or equal comparison in JUEL expressions'
  },
  {
    name: '>=',
    detail: 'var >= value',
    info: 'Greater than or equal comparison in JUEL expressions'
  },

  // Common JUEL/EL variable access patterns
  {
    name: '${variable}',
    detail: '${variableName}',
    info: 'Access process variable in JUEL expression'
  },
  {
    name: 'empty',
    detail: 'empty variable',
    info: 'Check if variable is empty or null in JUEL'
  },
  {
    name: 'not empty',
    detail: 'not empty variable',
    info: 'Check if variable is not empty in JUEL'
  }
];