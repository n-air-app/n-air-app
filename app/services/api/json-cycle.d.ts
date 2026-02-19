declare module 'json-cycle' {
  export function decycle(object: any): any;
  export function retrocycle(object: any): any;
  export function stringify(
    object: any,
    replacer?: (key: string, value: any) => any,
    space?: string | number,
  ): string;
  export function parse(text: string, reviver?: (key: string, value: any) => any): any;
}
