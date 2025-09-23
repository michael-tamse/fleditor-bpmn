// Type declarations for dmn-js modules

declare module 'dmn-js/lib/Modeler' {
  interface DmnModelerOptions {
    container?: string | Element;
    keyboard?: { bindTo?: Window | Document | Element };
    width?: string | number;
    height?: string | number;
    decisionTable?: {
      additionalModules?: any[];
    };
    literalExpression?: {
      additionalModules?: any[];
    };
    defaultInputExpressionLanguage?: string;
    defaultOutputExpressionLanguage?: string;
    defaultLiteralExpressionLanguage?: string;
    [key: string]: any;
  }

  interface DmnView {
    type: string;
    id?: string;
  }

  class DmnModeler {
    constructor(options?: DmnModelerOptions);

    importXML(xml: string): Promise<{ warnings: any[] }>;
    saveXML(callback: (err: any, xml?: string) => void): void;

    attachTo(container: Element): void;
    detach(): void;

    getViews(): DmnView[];
    getActiveView(): DmnView | null;
    open(view: DmnView): Promise<void>;

    _container?: Element;
  }

  export default DmnModeler;
}