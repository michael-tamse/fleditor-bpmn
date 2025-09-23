// Central factory for creating DmnJS instances with consistent Flowable/JUEL configuration
import DmnJS from 'dmn-js/lib/Modeler';

export interface DmnModelerConfig {
  container: string | Element;
  keyboard?: { bindTo?: Window | Document | Element };
  width?: string | number;
  height?: string | number;
}

/**
 * Creates a DmnJS modeler instance with consistent Flowable/JUEL-only configuration
 */
export function createFlowableDmnModeler(config: DmnModelerConfig) {
  return new DmnJS({
    container: config.container,
    keyboard: config.keyboard || { bindTo: window },
    width: config.width || '100%',
    height: config.height || '100%',

    // Flowable-spezifische Datentypen
    common: {
      dataTypes: [
        'collection',
        'string',
        'boolean',
        'number',
        'date'
      ],
      expressionLanguages: {
        options: [
          { value: 'juel', label: 'JUEL' }
        ],
        defaults: {
          inputCell: 'juel',
          outputCell: 'juel',
          editor: 'juel'
        }
      }
    },

    // Flowable-spezifische Module
    decisionTable: {
      additionalModules: [  ]
    },
    literalExpression: {
      additionalModules: [  ]
    },

    // JUEL als Standard-Sprache für Flowable
    defaultInputExpressionLanguage: 'juel',
    defaultOutputExpressionLanguage: 'juel',
    defaultLiteralExpressionLanguage: 'juel'
  });
}