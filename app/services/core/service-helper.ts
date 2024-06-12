/**
 * Classes with ServiceHelper decorator saves constructor's
 * arguments to send them with each called mutation.
 * We need to save constructor arguments to create the same
 * class instance in another window.
 * Caveats:
 * - constructor arguments must be able to be serialized
 * - constructor must not have side effects
 */
import { inheritMutations } from './stateful-service';

// export function ServiceHelper(): ClassDecorator {
//   return function (target: any) {
//     const original = target;

//     // create new constructor that will save arguments in instance
//     const f: any = function (this: any, ...args: any[]) {
//       original.apply(this, args);
//       this._isHelper = true;
//       this._constructorArgs = args;
//       this._resourceId = target.name + JSON.stringify(args);
//       return this;
//     };

//     // copy prototype so intanceof operator still works
//     f.prototype = original.prototype;

//     // vuex modules names related to constructor name
//     // so we need to save the name
//     Object.defineProperty(f, 'name', { value: target.name });

//     inheritMutations(f);

//     // return new constructor (will override original)
//     return f;
//   };
// }

export function ServiceHelper(parentServiceName: string) {
  return function <T extends { new (...args: any[]): {} }>(constr: T) {
    constr['_isHelperFor'] = parentServiceName;
    const klass = class extends constr {
      constructor(...args: any[]) {
        super(...args);
        this['_isHelper'] = true;
        this['_constructorArgs'] = args;
        this['_resourceId'] = constr.name + JSON.stringify(args);

        return new Proxy(this, {
          get: (target, key: string) => {
            console.log(`${parentServiceName} ${key}`);
            // if (
            //   typeof target[key] === 'function' &&
            //   key !== 'isDestroyed' //&&
            //   //ちょい  target['isDestroyed']()
            // ) {
            //   return () => {
            //     throw new Error(
            //       `Trying to call the method "${key}" on destroyed object "${this['_resourceId']}"`,
            //     );
            //   };
            // }

            return target[key];
          },
        });
      }
    };

    Object.defineProperty(klass, 'name', { value: constr.name });

    inheritMutations(klass);

    return klass;
  };
}
