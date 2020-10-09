# Overview
Objdb is a basic object that is being saved automatically.

You can store, edit, remove values inside of it, it will all be saved and can be accessed even after a system reboot.
Basically a database, powerful but not enough, still working on it to make it as good as expected

Requires **Node 10** and later

**New**: Partially supports [user defined prototypes](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Object_prototypes)
- check out how to use the *prototype restoring system* in [this section](#prototype-restoring-system)

## Project's advancement
- [x] Strongly typed (TypeScript)
- [x] Stores in a local file
- [x] Easy prototype restoring
- [x] Provides own serialization API
- [x] Support of circular structured objects and objects that are referenced several times
- [ ] Client and Server: remotely operate over the datas

## Supported data types
It supports the most of :
- the instances of the built-in classes **`Object` `Array` `Map` `Set` `Date` `Buffer` `String` `Boolean` `Number` `RegExp`**
- the primitive types `string` `number` `boolean` `object` `bigint` `undefined` `null`

## Limits
You can not use these types inside a database
- [Function / Class constructor / Generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions)
- [Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) and [WeakSet](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet)
- [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- and more

# Examples
## Understanding
```js
const { Database } = require('objdb');

const test = new Database(); // Stored in ./data/default.json
// Note: It does not save unless you modify

test.success = true;
test.some = {};
test.some.more = ['d', 'a', 't', 'a', 's'];
```

## Prototype restoring system
```js
const { Database } = require('objdb');

class Player { /* Imagination */ }
class Sword { /* Imagination */ }

/* Initialize the database */
const db = new Database({
	defaults: {
		players: new Map();
	},
	/* Add the constructors here */
	constructors: [ Player, Sword ]
});

const p1 = db.players.get('xXProKillerXx');
const p2 = db.players.get('Imagination');

const sword = p1.inventory[0];

p1.attack(p2, sword);
```

## Serialization API
```js
const { Serializer } = require('objdb');
const s = new Serializer();

// An object
const o = {testing: Infinity, serialization: Buffer.from('asd'), [0]: /ab+c/i};

// Serialize to json
const data = s.serialize(o);

// Deserialize from json
const o2 = s.deserialize(data);

console.log(o);
console.log(data);
console.log(o2);

/* Output:
 *   { '0': /ab+c/i, testing: Infinity, serialization: <Buffer 61 73 64> }
 *   {"version":"1.0","value":0,"references":[["Object",[[0,"0",1],[0,"testing",[3,"Infinity"]],[0,"serialization",2]]],["RegExp",[],"ab+c","i"],["Buffer",[],"YXNk"]]}
 *   { '0': /ab+c/i, testing: Infinity, serialization: <Buffer 61 73 64> }
 */
```
