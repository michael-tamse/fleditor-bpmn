// JUEL-only expression language provider for DMN.js
// Replaces the default expression language provider to only offer JUEL

type Lang = { label: string; value: string };

interface ExpressionLanguagesProvider {
  getAll(): Lang[];
  getDefault(): string;
  getDefaultMode(): string;
  getLabel(expressionLanguage: string): string;
}

const ALL_LANGUAGES: Lang[] = [ { label: 'JUEL', value: 'juel' } ];

function JuelOnlyExpressionLanguages(this: ExpressionLanguagesProvider) {
  // API wird von dmn-js abgefragt
  this.getAll = function () {
    return ALL_LANGUAGES;
  };

  this.getDefault = function () {
    return 'juel';
  };

  // getLabel method für dmn-js UI Rendering
  this.getLabel = function (expressionLanguage: string) {
    // Suche das Label für die gegebene Expression Language
    const language = ALL_LANGUAGES.find(lang => lang.value === expressionLanguage);
    return language ? language.label : 'JUEL'; // Fallback auf JUEL
  };

  // Optional – falls dmn-js nach UI-Modus fragt
  this.getDefaultMode = function () {
    return 'text';
  };
}

// Module für dmn-js additionalModules
export const JuelOnlyModule = {
  expressionLanguages: [ 'type', JuelOnlyExpressionLanguages ]
};